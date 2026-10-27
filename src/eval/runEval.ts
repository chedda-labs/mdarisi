import questions from "../../eval/questions.json";
import type { TutorSession } from "../tutor/session";

export type EvalRecord = Record<string, unknown>;

// Runs the test set through the same session the app uses: relevance gate,
// cached sub-strand prompt and generation settings. Marking happens later in
// tools/eval/score.mjs, so a run can be re-scored when the rules change.
export async function runEval(session: TutorSession, emit: (r: EvalRecord) => void, onStatus: (s: string) => void) {
  const { subStrand } = questions;
  emit({ phase: "start", subStrand });

  onStatus("Preparing");
  const t0 = Date.now();
  await session.prepare([subStrand], () => {});
  emit({ phase: "prepare", ms: Date.now() - t0 });

  const all = [
    ...questions.inScope.map((q) => ({ id: q.id, question: q.question, scope: "in" })),
    ...questions.outOfScope.map((q) => ({ id: q.id, question: q.question, scope: "out" })),
  ];
  for (const [i, q] of all.entries()) {
    onStatus(`Question ${i + 1} of ${all.length}`);
    const answer = await session.ask(subStrand, q.question, () => {});
    emit({ phase: "answer", ...q, kind: answer.kind, relevance: Number(answer.relevance.toFixed(4)), ...answer.timings, text: answer.text });
  }
  emit({ phase: "done" });
  onStatus("Done");
}
