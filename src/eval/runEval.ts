import questions from "../../eval/questions.json";
import type { TutorSession } from "../tutor/session";

export type EvalRecord = Record<string, unknown>;

// Runs the test set through the same session the app uses: relevance gate,
// cached sub-strand prompt and generation settings. Marking happens later in
// tools/eval/score.mjs, so a run can be re-scored when the rules change.
export async function runEval(session: TutorSession, emit: (r: EvalRecord) => void, onStatus: (s: string) => void) {
  const subStrands = questions.subStrands.map((s) => s.subStrand);
  emit({ phase: "start", subStrands });

  onStatus("Preparing");
  const t0 = Date.now();
  await session.prepare(subStrands, () => {});
  emit({ phase: "prepare", ms: Date.now() - t0 });

  const all = questions.subStrands.flatMap(({ subStrand, inScope, outOfScope }) => [
    ...inScope.map((q) => ({ subStrand, id: q.id, question: q.question, scope: "in" })),
    ...outOfScope.map((q) => ({ subStrand, id: q.id, question: q.question, scope: "out" })),
  ]);
  for (const [i, q] of all.entries()) {
    onStatus(`Question ${i + 1} of ${all.length}`);
    const answer = await session.ask(q.subStrand, q.question, () => {});
    emit({ phase: "answer", ...q, kind: answer.kind, relevance: Number(answer.relevance.toFixed(4)), ...answer.timings, text: answer.text });
  }
  emit({ phase: "done" });
  onStatus("Done");
}
