import { completion, loadModel, resume, suspend, VERBOSITY } from "@qvac/sdk";

import { subStrandContext } from "./context";
import type { ModelRole } from "./model";
import { buildPrompt, FALLBACK } from "./prompt";
import { buildIndex, EMBED_CONFIG, embedQuestion, rank, RELEVANCE_THRESHOLD, ROUTE_MARGIN, type RelevanceIndex } from "./relevance";

type Pack = Parameters<typeof subStrandContext>[0];

// Where a model file is on this device. The app copies bundled models out of
// the APK; the laptop eval runner reads them from bundle/models.
export type ResolveModelPath = (role: ModelRole, onCopyProgress: (percentage: number) => void) => Promise<string>;

// Six threads balanced prompt reading against writing speed on the demo
// phone (Snapdragon 685). 2048 tokens holds a sub-strand's lesson text
// (about 1,150 tokens with the examples), the question and the answer.
// Smaller batches cap the working memory used while reading that text,
// which pushed the app to about 1.95 GB with the defaults.
const LLM_CONFIG = {
  device: "cpu",
  ctx_size: 2048,
  threads: 6,
  "batch-size": 512,
  "ubatch-size": 256,
  verbosity: VERBOSITY.ERROR,
} as const;
// Enough for 3 short sentences and a check question.
const GENERATION = { predict: 72, temp: 0.2, seed: 42, reasoning_budget: 0 };
const PRIME_QUESTION = "Reply with OK.";

export type PrepareStep =
  | { step: "copy"; model: string; percentage: number }
  | { step: "load" }
  | { step: "read"; subStrand: string };

export type Answer = {
  kind: "answer" | "fallback";
  text: string;
  sources: { title: string; score: number }[];
  // Best match between the question and the lesson text; below
  // RELEVANCE_THRESHOLD the model isn't asked.
  relevance: number;
  // The sub-strand whose lesson text answered: the one that best matches the
  // question, which may not be the one the learner has open.
  subStrand: string;
  timings: { relevanceMs: number; firstWordMs?: number; totalMs: number; promptTokens?: number };
};

export class TutorSession {
  private llmId = "";
  private embedId = "";
  private indexes = new Map<string, RelevanceIndex>();
  // One completion at a time: Ask and Quiz share the model, so a call made
  // while another is running waits for it instead of failing.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private pack: Pack,
    private resolveModelPath: ResolveModelPath,
  ) {}

  // Copies models out of the APK on first launch, loads them, then reads each
  // sub-strand's lesson text once. The read is cached on disk by kvCache, so
  // later launches skip most of it.
  async prepare(subStrands: string[], onStep: (s: PrepareStep) => void) {
    const tutorPath = await this.resolveModelPath("tutor", (percentage) =>
      onStep({ step: "copy", model: "tutor", percentage }),
    );
    const embedPath = await this.resolveModelPath("embed", (percentage) =>
      onStep({ step: "copy", model: "embed", percentage }),
    );

    onStep({ step: "load" });
    this.embedId = await loadModel({ modelSrc: embedPath, modelType: "llamacpp-embedding", modelConfig: EMBED_CONFIG });
    this.llmId = await loadModel({ modelSrc: tutorPath, modelType: "llamacpp-completion", modelConfig: LLM_CONFIG });

    for (const subStrand of subStrands) {
      onStep({ step: "read", subStrand });
      const context = subStrandContext(this.pack, subStrand);
      this.indexes.set(subStrand, await buildIndex(this.embedId, context));
      await completion({
        modelId: this.llmId,
        history: buildPrompt(PRIME_QUESTION, context),
        stream: false,
        kvCache: subStrand,
        generationParams: { ...GENERATION, predict: 4 },
      }).final;
    }
  }

  // Answers from the open sub-strand unless another matches the question
  // clearly better. Sub-strands share words (salt, water, separate), so a
  // question from one can pass the gate on another whose lesson doesn't cover
  // it, and the model then makes an answer up.
  ask(openSubStrand: string, question: string, onText: (text: string) => void): Promise<Answer> {
    return this.exclusive(async () => {
      const t0 = Date.now();
      const embedding = await embedQuestion(this.embedId, question);
      let subStrand = openSubStrand;
      let rel = rank(this.indexes.get(openSubStrand)!, embedding);
      const open = rel.score;
      for (const [id, index] of this.indexes) {
        const r = rank(index, embedding);
        if (r.score > rel.score && r.score - open > ROUTE_MARGIN) [subStrand, rel] = [id, r];
      }
      const relevanceMs = Date.now() - t0;
      const sources = rel.ranked.slice(0, 2).map((r) => ({ title: r.chunk.title, score: r.score }));

      if (rel.score < RELEVANCE_THRESHOLD) {
        onText(FALLBACK);
        return { kind: "fallback", text: FALLBACK, sources: [], relevance: rel.score, subStrand: openSubStrand, timings: { relevanceMs, totalMs: Date.now() - t0 } };
      }

      const { text, firstWordMs, promptTokens } = await this.stream(subStrand, question, t0, onText);
      const kind = text.startsWith(FALLBACK) ? "fallback" : "answer";
      return {
        kind,
        text,
        sources: kind === "answer" ? sources : [],
        relevance: rel.score,
        subStrand,
        timings: { relevanceMs, firstWordMs, totalMs: Date.now() - t0, promptTokens },
      };
    });
  }

  // "Explain" on a wrong quiz answer. No relevance gate: the request is built
  // from the sub-strand's own practice item.
  explain(subStrand: string, request: string, onText: (text: string) => void): Promise<string> {
    return this.exclusive(async () => (await this.stream(subStrand, request, Date.now(), onText)).text);
  }

  private exclusive<T>(run: () => Promise<T>): Promise<T> {
    const result = this.queue.then(run);
    this.queue = result.catch(() => {});
    return result;
  }

  // Streams an answer after the sub-strand's cached prefix.
  private async stream(subStrand: string, userMessage: string, t0: number, onText: (text: string) => void) {
    const run = completion({
      modelId: this.llmId,
      history: buildPrompt(userMessage, this.indexes.get(subStrand)!.chunks),
      stream: true,
      kvCache: subStrand,
      generationParams: GENERATION,
    });
    let text = "";
    let firstWordMs: number | undefined;
    for await (const event of run.events) {
      if (event.type !== "contentDelta") continue;
      text += event.text;
      if (firstWordMs == null && text.trim()) firstWordMs = Date.now() - t0;
      onText(text);
    }
    const final = await run.final;
    return { text: final.contentText.trim(), firstWordMs, promptTokens: final.stats?.promptTokens };
  }

  // Inference already running finishes regardless; SDK calls made while
  // suspended throw until resume().
  suspend() {
    return suspend();
  }

  resume() {
    return resume();
  }
}
