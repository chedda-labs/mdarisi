#!/usr/bin/env node
// Summarises a bake-off run.
//
//   node tools/eval/bench-report.mjs <logcat.txt> [<meminfo.tsv>]
//
// logcat.txt:  `adb logcat -v epoch -s ReactNativeJS` captured during the run
// meminfo.tsv: lines of "<epoch ms>\t<PSS KB>" from tools/eval/sample-mem.sh
import fs from "node:fs";

const [logFile, memFile] = process.argv.slice(2);
if (!logFile) {
  console.error("usage: bench-report.mjs <logcat.txt> [<meminfo.tsv>]");
  process.exit(1);
}

const records = fs
  .readFileSync(logFile, "utf8")
  .split("\n")
  .map((line) => line.match(/\[bench\] (\{.*\})\s*$/)?.[1])
  .filter(Boolean)
  .map((json) => JSON.parse(json));

const mem = memFile
  ? fs
      .readFileSync(memFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split("\t").map(Number))
  : [];
const peakMb = (from, to) => {
  const xs = mem.filter(([t]) => t >= from && t <= to).map(([, kb]) => kb);
  return xs.length ? (Math.max(...xs) / 1024).toFixed(0) : "?";
};

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const s = (ms) => (ms / 1000).toFixed(1);
const by = (pred) => records.filter(pred);

console.log("## Speed (median of runs, wall clock)\n");
console.log("| Model | Threads | Load s | First token s | Total s | Tokens | Gen tok/s | Prompt tok/s |");
console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
const groups = new Map();
for (const r of by((r) => r.phase === "speed")) {
  const k = `${r.model}|${r.threads}`;
  groups.set(k, [...(groups.get(k) ?? []), r]);
}
for (const [k, runs] of groups) {
  const [model, threads] = k.split("|");
  const load = by((r) => r.phase === "load" && r.model === model && r.threads === Number(threads))[0];
  console.log(
    `| ${model} | ${threads} | ${load ? s(load.ms) : "?"} | ${s(median(runs.map((r) => r.ttftMs)))} | ` +
      `${s(median(runs.map((r) => r.totalMs)))} | ${median(runs.map((r) => r.stats?.generatedTokens ?? 0))} | ` +
      `${median(runs.map((r) => r.stats?.tokensPerSecond ?? 0)).toFixed(1)} | ` +
      `${median(runs.map((r) => r.stats?.promptTokensPerSecond ?? 0)).toFixed(1)} |`,
  );
}

console.log("\n## Quality (mark each answer against the key facts in src/bench/cases.ts)\n");
for (const r of by((r) => r.phase === "quality")) {
  console.log(`- **${r.model}, ${r.case}** (${s(r.ttftMs)} s first token, ${s(r.totalMs)} s total${r.thinking ? ", THINKING LEAKED" : ""}): ${r.text.replace(/\n+/g, " ")}`);
}

console.log("\n## Embedding and memory\n");
const embeds = by((r) => r.phase === "embed");
if (embeds.length) console.log(`- Query embedding: median ${median(embeds.map((r) => r.ms))} ms, ${embeds[0].dim} dimensions`);
const embedLoad = by((r) => r.phase === "load" && r.model === "embed")[0];
if (embedLoad) console.log(`- Embedding model load: ${s(embedLoad.ms)} s`);
for (const b of by((r) => r.phase === "both-loaded")) {
  const end = by((r) => r.phase === "embed" && r.t > b.t).at(-1)?.t ?? b.t;
  console.log(`- Peak app memory with ${b.model} + embedding model: ${peakMb(b.t, end + 2000)} MB PSS`);
}
for (const b of by((r) => r.phase === "best")) console.log(`- Fastest setting for ${b.model}: ${b.threads} threads`);
