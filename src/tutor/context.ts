import type { Chunk } from "./prompt";

type Pack = {
  items: { id: string; type: string }[];
  chunks: (Chunk & { itemId: string; subStrand: string })[];
};

// Teaching text the tutor answers from, in reading order. Practice-item
// explanations are left out: in context, the small model copies them into
// unrelated answers as if they were example Q&A. "Explain" on a wrong quiz
// answer passes that one item's explanation instead.
const ORDER = ["lesson", "example", "misconception"];

export function subStrandContext(pack: Pack, subStrand: string): Chunk[] {
  const typeOf = new Map(pack.items.map((it) => [it.id, it.type]));
  return pack.chunks
    .filter((c) => c.subStrand === subStrand && ORDER.includes(typeOf.get(c.itemId)!))
    .sort((a, b) => ORDER.indexOf(typeOf.get(a.itemId)!) - ORDER.indexOf(typeOf.get(b.itemId)!));
}
