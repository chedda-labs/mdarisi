import { completion, embed, loadModel, unloadModel, VERBOSITY } from "@qvac/sdk";

import pack from "../packs/g7-sci/pack.json";
import { devModelPath, type ModelRole } from "../tutor/model";
import { buildPrompt, type Chunk } from "../tutor/prompt";
import { EMBED_CONFIG } from "../tutor/relevance";
import { CASES, CTX_SIZE, GENERATION, LLMS, SPEED_CASE, SPEED_RUNS, THREADS } from "./cases";

type Case = (typeof CASES)[number];

const chunksById = new Map<string, Chunk>(pack.chunks.map((c) => [c.id, c]));

// One JSON line per event; tools/eval/bench-report.mjs reads these from logcat.
function emit(record: Record<string, unknown>) {
  console.log(`[bench] ${JSON.stringify({ t: Date.now(), ...record })}`);
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function loadLlm(role: ModelRole, threads: number) {
  const t0 = Date.now();
  const modelId = await loadModel({
    modelSrc: devModelPath(role),
    modelType: "llamacpp-completion",
    modelConfig: { device: "cpu", ctx_size: CTX_SIZE, threads, verbosity: VERBOSITY.ERROR },
  });
  emit({ phase: "load", model: role, threads, ms: Date.now() - t0 });
  return modelId;
}

async function runCase(modelId: string, role: ModelRole, threads: number, c: Case, kind: string) {
  const history = buildPrompt(
    c.question,
    c.chunks.map((id) => chunksById.get(id)!),
  );
  const t0 = Date.now();
  let firstAt: number | null = null;
  const run = completion({
    modelId,
    history,
    stream: true,
    captureThinking: true,
    // Qwen3 thinks before answering unless told not to; the budget is ignored by Llama.
    generationParams: { ...GENERATION, reasoning_budget: 0 },
  });
  for await (const event of run.events) {
    if (event.type === "contentDelta" && firstAt == null && event.text.trim()) firstAt = Date.now();
  }
  const final = await run.final;
  const end = Date.now();
  const record = {
    phase: kind,
    model: role,
    threads,
    case: c.id,
    ttftMs: (firstAt ?? end) - t0,
    totalMs: end - t0,
    stats: final.stats,
    thinking: Boolean(final.thinkingText?.trim()) || final.raw.fullText.includes("<think>"),
    text: final.contentText.trim(),
  };
  emit(record);
  return record;
}

export async function runBench(onStatus: (s: string) => void) {
  emit({ phase: "start" });
  const best: Partial<Record<ModelRole, number>> = {};

  for (const role of LLMS) {
    const scores: { threads: number; ttft: number; total: number }[] = [];
    for (const threads of THREADS) {
      onStatus(`${role}: speed, ${threads} threads`);
      const modelId = await loadLlm(role, threads);
      await runCase(modelId, role, threads, SPEED_CASE, "warmup");
      const runs = [];
      for (let i = 0; i < SPEED_RUNS; i++) runs.push(await runCase(modelId, role, threads, SPEED_CASE, "speed"));
      await unloadModel({ modelId, clearStorage: false });
      scores.push({ threads, ttft: median(runs.map((r) => r.ttftMs)), total: median(runs.map((r) => r.totalMs)) });
    }
    // Total time depends on answer length, so rank by time to first token.
    scores.sort((a, b) => a.ttft - b.ttft);
    best[role] = scores[0].threads;
    emit({ phase: "best", model: role, ...scores[0] });
  }

  // Quality on every case at each model's fastest setting, with the embedding
  // model loaded alongside to see both in memory together.
  onStatus("embedding model: load");
  let t0 = Date.now();
  const embedId = await loadModel({
    modelSrc: devModelPath("embed"),
    modelType: "llamacpp-embedding",
    modelConfig: EMBED_CONFIG,
  });
  emit({ phase: "load", model: "embed", ms: Date.now() - t0 });

  for (const role of LLMS) {
    onStatus(`${role}: quality`);
    const modelId = await loadLlm(role, best[role]!);
    emit({ phase: "both-loaded", model: role });
    for (const c of CASES) await runCase(modelId, role, best[role]!, c, "quality");
    for (const c of CASES) {
      t0 = Date.now();
      const { embedding } = await embed({ modelId: embedId, text: `task: search result | query: ${c.question}` });
      emit({ phase: "embed", case: c.id, ms: Date.now() - t0, dim: embedding.length });
    }
    await unloadModel({ modelId, clearStorage: false });
  }
  await unloadModel({ modelId: embedId, clearStorage: false });

  emit({ phase: "done" });
  onStatus("Done");
}
