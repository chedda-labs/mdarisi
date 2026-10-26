import type { ModelRole } from "../tutor/model";

// Grounded questions with hand-picked chunks, so the bench measures the LLM
// alone; retrieval is measured separately. Key facts are marked by hand.
export const CASES = [
  {
    id: "q1",
    question: "Is salt water a mixture? Why?",
    chunks: ["itm_mix_l01", "itm_mix_m01", "itm_mix_l02"],
    keyFacts: ["yes", "salt and water are not chemically joined, or the salt can be got back"],
  },
  {
    id: "q2",
    question: "How can I separate sand from water?",
    chunks: ["itm_mix_l03", "itm_mix_e01", "itm_mix_l02"],
    keyFacts: ["filtering (decanting also acceptable)"],
  },
  {
    id: "q3",
    question: "What is a solute?",
    chunks: ["itm_mix_l02", "itm_mix_l01", "itm_mix_m02"],
    keyFacts: ["the substance that dissolves", "example such as salt or sugar"],
  },
  {
    id: "q4",
    question: "Does sugar disappear when it dissolves in tea?",
    chunks: ["itm_mix_m02", "itm_mix_l02", "itm_mix_l01"],
    keyFacts: ["no", "evidence: sweet taste, same mass, or left behind on evaporation"],
  },
  {
    id: "q5",
    question: "Is githeri a uniform mixture?",
    chunks: ["itm_mix_l02", "itm_mix_l01", "itm_mix_m01"],
    keyFacts: ["no, it is non-uniform", "you can see the maize and beans"],
  },
] as const;

// More in-scope phrasings and out-of-scope questions, to calibrate the
// relevance gate and widen the quality sample.
export const MORE_IN_SCOPE = [
  { id: "q6", question: "What is a solvent?", keyFacts: ["the liquid a solute dissolves in", "example such as water"] },
  { id: "q7", question: "How do you get salt back from sea water?", keyFacts: ["evaporation / heating the water"] },
  { id: "q8", question: "Is air a mixture?", keyFacts: ["yes", "gases such as nitrogen and oxygen"] },
  {
    id: "q9",
    question: "Why does muddy water become clear when it is left to stand?",
    keyFacts: ["the soil settles at the bottom", "it is a non-uniform mixture"],
  },
];

export const OUT_OF_SCOPE = [
  { id: "x1", question: "How do I solve 2x + 3 = 7?" },
  { id: "x2", question: "What is the capital of France?" },
  { id: "x3", question: "What is photosynthesis?" },
  { id: "x4", question: "How do I cook ugali?" },
  { id: "x5", question: "Who wrote the Kenyan national anthem?" },
  { id: "x6", question: "What causes rain?" },
];

export const SPEED_CASE = CASES[0];
export const LLMS: ModelRole[] = ["baseline", "tutor"];
export const THREADS = [4, 6, 8];
export const SPEED_RUNS = 3;

export const GENERATION = { predict: 96, temp: 0.2, seed: 42 };
export const CTX_SIZE = 2048;
