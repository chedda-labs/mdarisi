// Quiz marking is plain code against the authored answer key; the model never marks.

export type PracticeItem = {
  id: string;
  prompt: string;
  choices?: string[];
  answer: { kind: string; value: number | boolean };
  hints?: string[];
  explanation: string;
};

// What the learner chose or typed: a choice index (mcq), true/false, or raw text (numeric).
export type Response = number | boolean | string;

// Accepts units and spaces in numeric answers ("120 g", "120g").
function parseNumber(text: string): number | null {
  const match = text.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function isCorrect(item: PracticeItem, response: Response): boolean {
  const { kind, value } = item.answer;
  if (kind === "numeric") {
    const n = typeof response === "string" ? parseNumber(response) : Number(response);
    return n != null && Math.abs(n - Number(value)) < 1e-6;
  }
  return response === value;
}

export function responseText(item: PracticeItem, response: Response): string {
  if (item.answer.kind === "mcq") return item.choices?.[response as number] ?? String(response);
  if (item.answer.kind === "truefalse") return response ? "True" : "False";
  return String(response);
}

export function correctAnswerText(item: PracticeItem): string {
  return responseText(item, item.answer.value);
}
