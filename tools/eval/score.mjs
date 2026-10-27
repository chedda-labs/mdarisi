#!/usr/bin/env node
// Scores a test-set run against eval/questions.json and prints Markdown.
//
//   node tools/eval/score.mjs <run.jsonl | logcat.txt>
//
// Accepts the laptop runner's JSONL or `adb logcat -v epoch -s ReactNativeJS`
// output with "[eval] {...}" lines from the phone.
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: score.mjs <run.jsonl | logcat.txt>");
  process.exit(1);
}

const questions = JSON.parse(fs.readFileSync(new URL("../../eval/questions.json", import.meta.url), "utf8"));
const records = fs
  .readFileSync(file, "utf8")
  .split("\n")
  .map((line) => (line.startsWith("{") ? line : line.match(/\[eval\] (\{.*\})\s*$/)?.[1]))
  .filter(Boolean)
  .map((json) => JSON.parse(json));
const answers = new Map(records.filter((r) => r.phase === "answer").map((r) => [r.id, r]));

const matches = (patterns, text) => patterns.some((p) => new RegExp(p, "i").test(text));
const missingFacts = (q, text) => q.keyFacts.filter((k) => !matches(k.any, text));
const wrongClaims = (q, text) => (q.wrong ?? []).filter((w) => matches(w.any, text));

// Question ids are unique across sub-strands.
const rows = [];
for (const { subStrand, inScope, outOfScope } of questions.subStrands) {
  for (const q of inScope) {
    const a = answers.get(q.id);
    if (!a) continue;
    const missing = a.kind === "answer" ? missingFacts(q, a.text) : q.keyFacts;
    const wrong = a.kind === "answer" ? wrongClaims(q, a.text) : [];
    // Runs from before routing have no "from"; they answered from the open sub-strand.
    const wrongSource = a.kind === "answer" && (a.from ?? subStrand) !== (q.from ?? subStrand);
    const ok = missing.length === 0 && wrong.length === 0 && !wrongSource;
    // "Main point" is the first key fact: the yes/no or the core definition.
    const main = a.kind === "answer" && !missing.includes(q.keyFacts[0]) && wrong.length === 0 && !wrongSource;
    const problems = [...missing.map((k) => k.fact), ...wrong.map((w) => `says: ${w.claim}`), ...(wrongSource ? [`answered from ${a.from}`] : [])];
    const note = a.kind === "fallback" ? "refused" : problems.join("; ");
    rows.push({ subStrand, q, a, pass: ok, main, note });
  }
  for (const q of outOfScope) {
    const a = answers.get(q.id);
    if (!a) continue;
    const pass = a.kind === "fallback";
    rows.push({ subStrand, q, a, pass, main: pass, note: pass ? (a.firstWordMs == null ? "gate" : "model") : "answered" });
  }
}

const s = (ms) => (ms == null ? "-" : (ms / 1000).toFixed(1));
const median = (xs) => {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};
const oneLine = (t) => t.replace(/\s+/g, " ").slice(0, 160);

console.log("| ID | Question | Pass | Relevance | First word s | Total s | Missing / note | Answer |");
console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
for (const { q, a, pass, note } of rows) {
  console.log(`| ${q.id} | ${q.question} | ${pass ? "✅" : "❌"} | ${a.relevance} | ${s(a.firstWordMs)} | ${s(a.totalMs)} | ${note} | ${oneLine(a.text)} |`);
}

// One column per sub-strand in the run, then all of them together.
const groups = [...new Set(rows.map((r) => r.subStrand))].map((id) => [id, rows.filter((r) => r.subStrand === id)]);
if (groups.length > 1) groups.push(["All", rows]);

function summary(rs) {
  const inRows = rs.filter((r) => r.q.keyFacts);
  const outRows = rs.filter((r) => !r.q.keyFacts);
  const answered = inRows.filter((r) => r.a.kind === "answer");
  const range = (xs) => (xs.length ? `${Math.min(...xs)} – ${Math.max(...xs)}` : "-");
  return {
    "In scope: every key fact": `${inRows.filter((r) => r.pass).length} / ${inRows.length}`,
    "In scope: main point right": `${inRows.filter((r) => r.main).length} / ${inRows.length}`,
    "In scope: wrongly refused": inRows.length - answered.length,
    "Out of scope: refused": `${outRows.filter((r) => r.pass).length} / ${outRows.length}`,
    "Relevance, in scope": range(inRows.map((r) => r.a.relevance)),
    "Relevance, out of scope": range(outRows.map((r) => r.a.relevance)),
    "Median first word (answered)": `${s(median(answered.map((r) => r.a.firstWordMs)))} s`,
    "Median total (answered)": `${s(median(answered.map((r) => r.a.totalMs)))} s`,
  };
}

const columns = groups.map(([, rs]) => summary(rs));
console.log(`\n| Measure | ${groups.map(([id]) => id).join(" | ")} |`);
console.log(`| --- |${" --- |".repeat(groups.length)}`);
for (const m of Object.keys(columns[0])) console.log(`| ${m} | ${columns.map((c) => c[m]).join(" | ")} |`);
const prepare = records.find((r) => r.phase === "prepare");
if (prepare) console.log(`\nPrepare (load models, read lesson text): ${s(prepare.ms)} s`);
