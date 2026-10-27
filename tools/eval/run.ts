// Runs the test set on the laptop with the same models, prompt and settings
// as the app, for quick iteration. Report numbers come from the phone run.
//
//   npm run eval -- [label]
//
// Writes eval/results/<label>.jsonl; score it with tools/eval/score.mjs.
import fs from "node:fs";
import path from "node:path";

import { close } from "@qvac/sdk";

import pack from "../../src/packs/g7-sci/pack.json";
import { runEval } from "../../src/eval/runEval";
import models from "../../src/tutor/models.json";
import { TutorSession } from "../../src/tutor/session";

const label = process.argv[2] ?? `laptop-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
const out = path.join("eval/results", `${label}.jsonl`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, "");

async function main() {
  const session = new TutorSession(pack, async (role) => path.resolve("bundle/models", models[role].file));
  await runEval(
    session,
    (record) => fs.appendFileSync(out, JSON.stringify({ t: Date.now(), ...record }) + "\n"),
    (status) => console.log(status),
  );
  console.log(`Wrote ${out}`);
  await close();
}

main();
