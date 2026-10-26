import { embed, VERBOSITY } from "@qvac/sdk";

import type { Chunk } from "./prompt";

// QVAC defaults embedding models to the GPU with every layer offloaded. On
// the demo phone's Adreno 610 that roughly doubled app memory and stalled the
// LLM, so pin it to the CPU. Chunks are well under 512 tokens.
export const EMBED_CONFIG = {
  device: "cpu",
  gpuLayers: 0,
  batchSize: 512,
  verbosity: VERBOSITY.ERROR,
} as const;

// EmbeddingGemma expects different prefixes for documents and queries.
const docText = (c: Chunk) => `title: ${c.title} | text: ${c.text}`;
const queryText = (q: string) => `task: search result | query: ${q}`;

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / Math.sqrt(na * nb);
}

// Calibrated on the mixtures sub-strand (2026-10-26): in-scope questions
// scored 0.445-0.860, out-of-scope 0.172-0.331. Midway between the two.
// Re-check as the test set grows.
export const RELEVANCE_THRESHOLD = 0.39;

export type RelevanceIndex = { chunks: Chunk[]; vectors: number[][] };

export async function buildIndex(embedModelId: string, chunks: Chunk[]): Promise<RelevanceIndex> {
  const { embedding } = await embed({ modelId: embedModelId, text: chunks.map(docText) });
  return { chunks, vectors: embedding };
}

// Highest similarity between the question and any chunk of the sub-strand.
// Below the gate's threshold the tutor replies with the fallback without
// calling the LLM, since a small model can't be trusted to refuse by itself.
export async function relevance(embedModelId: string, index: RelevanceIndex, question: string) {
  const { embedding } = await embed({ modelId: embedModelId, text: queryText(question) });
  const ranked = index.vectors
    .map((v, i) => ({ chunk: index.chunks[i], score: cosine(embedding, v) }))
    .sort((a, b) => b.score - a.score);
  return { score: ranked[0].score, chunkId: ranked[0].chunk.id, ranked };
}
