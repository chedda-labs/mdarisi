import { completion, loadModel, resume, suspend, VERBOSITY } from "@qvac/sdk";

import { subStrandContext } from "./context";
import { resolveModelPath } from "./model";
import { buildPrompt, FALLBACK } from "./prompt";
import { buildIndex, EMBED_CONFIG, relevance, RELEVANCE_THRESHOLD, type RelevanceIndex } from "./relevance";

type Pack = Parameters<typeof subStrandContext>[0];

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
  timings: { relevanceMs: number; firstWordMs?: number; totalMs: number; promptTokens?: number };
};

export class TutorSession {
  private llmId = "";
  private embedId = "";
  private indexes = new Map<string, RelevanceIndex>();
  private busy = false;

  constructor(private pack: Pack) {}

  // Copies models out of the APK on first launch, loads them, then reads each
  // sub-strand's lesson text once. The read is cached on disk by kvCache, so
  // later launches skip most of it.
  async prepare(subStrands: string[], onStep: (s: PrepareStep) => void) {
    const tutorPath = await resolveModelPath("tutor", (percentage) =>
      onStep({ step: "copy", model: "tutor", percentage }),
    );
    const embedPath = await resolveModelPath("embed", (percentage) =>
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

  async ask(subStrand: string, question: string, onText: (text: string) => void): Promise<Answer> {
    if (this.busy) throw new Error("Already answering a question");
    this.busy = true;
    try {
      const index = this.indexes.get(subStrand)!;
      const t0 = Date.now();
      const rel = await relevance(this.embedId, index, question);
      const relevanceMs = Date.now() - t0;
      const sources = rel.ranked.slice(0, 2).map((r) => ({ title: r.chunk.title, score: r.score }));

      if (rel.score < RELEVANCE_THRESHOLD) {
        onText(FALLBACK);
        return { kind: "fallback", text: FALLBACK, sources: [], timings: { relevanceMs, totalMs: Date.now() - t0 } };
      }

      const run = completion({
        modelId: this.llmId,
        history: buildPrompt(question, index.chunks),
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
      text = final.contentText.trim();
      const kind = text.startsWith(FALLBACK) ? "fallback" : "answer";
      return {
        kind,
        text,
        sources: kind === "answer" ? sources : [],
        timings: { relevanceMs, firstWordMs, totalMs: Date.now() - t0, promptTokens: final.stats?.promptTokens },
      };
    } finally {
      this.busy = false;
    }
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
