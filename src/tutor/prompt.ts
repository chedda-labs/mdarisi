export const FALLBACK = "I don't know that yet. Ask your teacher.";

export type Chunk = { id: string; title: string; text: string };
export type Message = { role: "system" | "user" | "assistant"; content: string };

const INSTRUCTIONS =
  "You are a patient Grade 7 science tutor in Kenya. Answer ONLY using the lesson text below.\n" +
  `If the lesson text does not contain the answer, reply exactly: ${FALLBACK}\n` +
  "Answer the learner's question directly in at most 3 short sentences of simple English. " +
  "If the question can be answered yes or no, start with Yes or No. " +
  "Always give one example or reason from the lesson. " +
  'Then write one short check question on a new line starting with "Check:". ' +
  "Do not repeat the learner's question and do not add any other questions or answers.";

// Fixed example turns that show the answer format and the fallback. They sit
// before the learner's question, so they are part of the cached prefix.
const EXAMPLES: Message[] = [
  { role: "user", content: "What does a magnet separate?" },
  {
    role: "assistant",
    content:
      "A magnet separates iron from things that are not magnetic. " +
      "For example, it can pull iron filings out of sand.\nCheck: Is sand attracted to a magnet?",
  },
  { role: "user", content: "Is pure water a mixture?" },
  {
    role: "assistant",
    content:
      "No. Pure water is a pure substance because it is made of only one kind of matter. " +
      "Salt water is a mixture because it has two substances.\nCheck: Is gold a pure substance?",
  },
  { role: "user", content: "Who is the president of Kenya?" },
  { role: "assistant", content: FALLBACK },
];

function systemPrompt(chunks: Chunk[]): string {
  const lesson = chunks.map((c, i) => `[${i + 1}] ${c.title}: ${c.text}`).join("\n");
  return `${INSTRUCTIONS}\n\nLesson text:\n${lesson}`;
}

// The tutor answers only from the given lesson text; FALLBACK is the exact
// sentence it must use when that text doesn't cover the question. Given a
// whole sub-strand, everything before the question is identical for every
// question, so a KV cache keyed on the sub-strand lets the model read the
// lesson text once and only process each new question.
export function buildPrompt(question: string, chunks: Chunk[]): Message[] {
  return [{ role: "system", content: systemPrompt(chunks) }, ...EXAMPLES, { role: "user", content: question }];
}
