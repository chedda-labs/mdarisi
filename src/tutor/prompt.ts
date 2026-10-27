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
  // With only the "No." example, answers often began "No." and then agreed
  // with the question ("No. Soil is a mixture").
  { role: "user", content: "Is iron a metal?" },
  {
    role: "assistant",
    content: "Yes. Iron is a metal because it is shiny and conducts heat and electricity.\nCheck: Is sulphur a metal?",
  },
  { role: "user", content: "Who is the president of Kenya?" },
  { role: "assistant", content: FALLBACK },
];

// The user message for "Explain" on a wrong quiz answer. It goes after
// the cached sub-strand prefix, so only these few lines need reading.
export function explainRequest(q: {
  prompt: string;
  learnerAnswer: string;
  correctAnswer: string;
  explanation: string;
}): string {
  // Written about the learner, not as them: in the first person the model
  // answered as the learner and invented what they had been thinking. Given
  // no opening words it began "You are wrong" (or, falsely, "You are correct"),
  // and telling it not to made that more likely.
  return (
    `A learner answered this quiz question.\nQuestion: ${q.prompt}\n` +
    `Learner's answer: ${q.learnerAnswer}\nCorrect answer: ${q.correctAnswer}\n` +
    `Teacher's note: ${q.explanation}\n` +
    `Using the teacher's note, explain in 2 or 3 short sentences, talking to the learner as "you". ` +
    `Begin with "${q.correctAnswer} is the answer because". Then say why "${q.learnerAnswer}" does not fit.`
  );
}

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
