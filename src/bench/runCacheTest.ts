import { completion, deleteCache, loadModel, unloadModel, VERBOSITY } from "@qvac/sdk";

import pack from "../packs/g7-sci/pack.json";
import { subStrandContext } from "../tutor/context";
import { devModelPath, type ModelRole } from "../tutor/model";
import { buildPrompt } from "../tutor/prompt";
import { buildIndex, EMBED_CONFIG, relevance, type RelevanceIndex } from "../tutor/relevance";
import { CASES, GENERATION, MORE_IN_SCOPE, OUT_OF_SCOPE } from "./cases";

const SUB_STRAND = "g7.sci.mix";
const MODELS: ModelRole[] = ["tutor"];
const THREADS = 6;
// Whole sub-strand + examples + question + answer.
const CTX_SIZE = 3072;
const PRIME_QUESTION = "Reply with OK.";
// Enough for 3 short sentences and a check question.
const PREDICT = 72;

const context = subStrandContext(pack, SUB_STRAND);

function emit(record: Record<string, unknown>) {
  console.log(`[cache] ${JSON.stringify({ t: Date.now(), ...record })}`);
}

async function load(role: ModelRole) {
  const t0 = Date.now();
  const modelId = await loadModel({
    modelSrc: devModelPath(role),
    modelType: "llamacpp-completion",
    modelConfig: { device: "cpu", ctx_size: CTX_SIZE, threads: THREADS, verbosity: VERBOSITY.ERROR },
  });
  emit({ phase: "load", model: role, ms: Date.now() - t0 });
  return modelId;
}

async function ask(
  modelId: string,
  role: ModelRole,
  kvCache: string,
  caseId: string,
  question: string,
  phase: string,
  gate?: { embedId: string; index: RelevanceIndex; scope: "in" | "out" },
) {
  // Score every question but still run the LLM, so the threshold can be
  // chosen afterwards from the logged scores.
  let rel: Record<string, unknown> = {};
  if (gate) {
    const r0 = Date.now();
    const { score, chunkId } = await relevance(gate.embedId, gate.index, question);
    rel = { scope: gate.scope, score: Number(score.toFixed(4)), bestChunk: chunkId, scoreMs: Date.now() - r0 };
  }
  const t0 = Date.now();
  let firstAt: number | null = null;
  const run = completion({
    modelId,
    history: buildPrompt(question, context),
    stream: true,
    kvCache,
    generationParams: { ...GENERATION, predict: PREDICT, reasoning_budget: 0 },
  });
  for await (const event of run.events) {
    if (event.type === "contentDelta" && firstAt == null && event.text.trim()) firstAt = Date.now();
  }
  const final = await run.final;
  const end = Date.now();
  emit({
    phase,
    model: role,
    case: caseId,
    ...rel,
    ttftMs: (firstAt ?? end) - t0,
    totalMs: end - t0,
    promptTokens: final.stats?.promptTokens,
    cacheTokens: final.stats?.cacheTokens,
    genTokens: final.stats?.generatedTokens,
    genTps: final.stats?.tokensPerSecond,
    text: final.contentText.trim(),
  });
}

export async function runCacheTest(onStatus: (s: string) => void) {
  emit({ phase: "start", chunks: context.length });

  onStatus("embedding model: load and index");
  let t0 = Date.now();
  const embedId = await loadModel({
    modelSrc: devModelPath("embed"),
    modelType: "llamacpp-embedding",
    modelConfig: EMBED_CONFIG,
  });
  emit({ phase: "load", model: "embed", ms: Date.now() - t0 });
  t0 = Date.now();
  const index = await buildIndex(embedId, context);
  emit({ phase: "index", chunks: context.length, ms: Date.now() - t0 });

  for (const role of MODELS) {
    const kvCache = `${SUB_STRAND}-${role}`;
    await deleteCache({ kvCacheKey: kvCache });

    onStatus(`${role}: priming cache`);
    let modelId = await load(role);
    await ask(modelId, role, kvCache, "prime", PRIME_QUESTION, "prime");

    onStatus(`${role}: questions`);
    for (const c of [...CASES, ...MORE_IN_SCOPE]) {
      await ask(modelId, role, kvCache, c.id, c.question, "cached", { embedId, index, scope: "in" });
    }
    for (const c of OUT_OF_SCOPE) {
      await ask(modelId, role, kvCache, c.id, c.question, "cached", { embedId, index, scope: "out" });
    }

    // Does the cache survive an unload, as it would an app restart?
    onStatus(`${role}: after reload`);
    await unloadModel({ modelId, clearStorage: false });
    modelId = await load(role);
    await ask(modelId, role, kvCache, CASES[0].id, CASES[0].question, "reloaded");
    await unloadModel({ modelId, clearStorage: false });
  }
  await unloadModel({ modelId: embedId, clearStorage: false });
  emit({ phase: "done" });
  onStatus("Done");
}
