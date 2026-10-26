#!/usr/bin/env node
// Builds src/packs/<pack>/pack.json from content/<pack>/{slos.json,items.jsonl}.
//
//   node tools/pack-builder/build.mjs g7-sci [--allow-drafts]
//
// --allow-drafts  include items not yet approved by a reviewer (benchmarks only)
//
// Chunks ship without vectors: the app embeds a sub-strand's few chunks on
// the device when it primes that sub-strand.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const [packName, ...flags] = process.argv.slice(2);
if (!packName) fail("usage: build.mjs <pack> [--allow-drafts]");
const allowDrafts = flags.includes("--allow-drafts");

const MAX_CHUNK_WORDS = 180;
const ITEM_TYPES = new Set(["lesson", "example", "misconception", "practice"]);
const ANSWER_KINDS = new Set(["mcq", "truefalse", "numeric"]);

function fail(msg) {
  console.error(`pack-builder: ${msg}`);
  process.exit(1);
}

const srcDir = path.join(root, "content", packName);
const slos = JSON.parse(fs.readFileSync(path.join(srcDir, "slos.json"), "utf8"));
const sloToSubStrand = new Map();
for (const ss of slos.subStrands) for (const slo of ss.slos) sloToSubStrand.set(slo.id, ss.id);

const items = fs
  .readFileSync(path.join(srcDir, "items.jsonl"), "utf8")
  .split("\n")
  .filter((line) => line.trim())
  .map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      fail(`items.jsonl line ${i + 1}: ${e.message}`);
    }
  });

// Validate every item, then keep the approved ones.
const seen = new Set();
for (const item of items) {
  const where = `item ${item.id ?? "(no id)"}`;
  if (!item.id || seen.has(item.id)) fail(`${where}: missing or duplicate id`);
  seen.add(item.id);
  if (!ITEM_TYPES.has(item.type)) fail(`${where}: unknown type ${item.type}`);
  if (!item.slos?.length) fail(`${where}: no slos`);
  for (const slo of item.slos) if (!sloToSubStrand.has(slo)) fail(`${where}: unknown slo ${slo}`);
  if (item.type === "practice") {
    if (!item.prompt || !item.explanation) fail(`${where}: practice needs prompt and explanation`);
    if (!ANSWER_KINDS.has(item.answer?.kind)) fail(`${where}: answer kind must be mcq, truefalse or numeric`);
    if (item.answer.kind === "mcq" && !(item.choices?.length > item.answer.value)) fail(`${where}: mcq answer out of range`);
  } else if (!item.title || !item.body) {
    fail(`${where}: ${item.type} needs title and body`);
  }
  if (!["draft", "approved"].includes(item.status)) fail(`${where}: status must be draft or approved`);
}
const included = items.filter((it) => it.status === "approved" || allowDrafts);
const drafts = included.filter((it) => it.status !== "approved").length;

// One chunk per lesson, example and misconception, plus one per practice
// explanation (used by "Explain"); long text is split on sentence boundaries.
function split(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const parts = [];
  let cur = [];
  for (const s of sentences) {
    const words = cur.join(" ").split(/\s+/).length + s.split(/\s+/).length;
    if (cur.length && words > MAX_CHUNK_WORDS) {
      parts.push(cur.join(" ").trim());
      cur = [];
    }
    cur.push(s.trim());
  }
  if (cur.length) parts.push(cur.join(" ").trim());
  return parts;
}

const chunks = [];
for (const item of included) {
  const subStrand = sloToSubStrand.get(item.slos[0]);
  const title = item.type === "practice" ? `Explanation: ${item.prompt}` : item.title;
  const text = item.type === "practice" ? item.explanation : item.body;
  split(text).forEach((part, i, all) => {
    chunks.push({
      id: all.length > 1 ? `${item.id}#${i}` : item.id,
      itemId: item.id,
      subStrand,
      title,
      text: part,
    });
  });
}

const pack = {
  manifest: {
    pack: slos.pack,
    version: "0.1.0",
    curriculumVersion: slos.curriculumVersion,
    builtAt: new Date().toISOString(),
    drafts,
  },
  subStrands: slos.subStrands,
  items: included,
  chunks,
};

const outDir = path.join(root, "src", "packs", packName);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "pack.json"), JSON.stringify(pack, null, 2) + "\n");
console.log(
  `pack-builder: ${included.length} items (${drafts} drafts), ${chunks.length} chunks -> src/packs/${packName}/pack.json`,
);
