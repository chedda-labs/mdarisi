import React, { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { correctAnswerText, isCorrect, responseText, type PracticeItem, type Response } from "../assessment/mark";
import { explainRequest } from "../tutor/prompt";
import type { TutorSession } from "../tutor/session";
import AnswerBody from "./AnswerBody";
import { colors, fonts, radius, space, type } from "./theme";
import { Button, Icon, MwalimuAvatar, ProgressBar } from "./ui";

export const XP_PER_CORRECT = 10;

export type QuizResult = { correct: number; total: number; xp: number; ms: number; tricky: PracticeItem[] };

// One wrong answer gets the authored hint and another try; a second wrong
// answer reveals the correct one and offers "Ask Mwalimu why".
type Attempt =
  | { state: "answering"; wrong: Response[] }
  | { state: "correct"; wrong: Response[] }
  | { state: "wrong"; wrong: Response[] };

const LETTERS = "ABCDEFGH";

export default function QuizView({
  session,
  subStrand,
  subStrandName,
  items,
  onXp,
  onFinish,
}: {
  session: TutorSession;
  subStrand: string;
  subStrandName: string;
  items: PracticeItem[];
  onXp: (xp: number) => void;
  onFinish: (result: QuizResult) => void;
}) {
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState<Attempt>({ state: "answering", wrong: [] });
  const [typed, setTyped] = useState("");
  const [explanation, setExplanation] = useState<{ text: string; done: boolean } | null>(null);
  const started = useRef(Date.now());
  const result = useRef({ correct: 0, xp: 0, tricky: [] as PracticeItem[] });

  const item = items[index];
  const settled = attempt.state !== "answering";

  function submit(response: Response) {
    if (attempt.state !== "answering") return;
    if (isCorrect(item, response)) {
      result.current.correct += 1;
      result.current.xp += XP_PER_CORRECT;
      if (attempt.wrong.length > 0) result.current.tricky.push(item);
      onXp(XP_PER_CORRECT);
      setAttempt({ state: "correct", wrong: attempt.wrong });
    } else if (attempt.wrong.length === 0 && item.hints?.length) {
      setAttempt({ state: "answering", wrong: [response] });
      setTyped("");
    } else {
      result.current.tricky.push(item);
      setAttempt({ state: "wrong", wrong: [...attempt.wrong, response] });
    }
  }

  async function explain() {
    const learnerAnswer = attempt.wrong[attempt.wrong.length - 1];
    setExplanation({ text: "", done: false });
    const request = explainRequest({
      prompt: item.prompt,
      learnerAnswer: responseText(item, learnerAnswer),
      correctAnswer: correctAnswerText(item),
      explanation: item.explanation,
    });
    try {
      const text = await session.explain(subStrand, request, (partial) => setExplanation({ text: partial, done: false }));
      setExplanation({ text, done: true });
    } catch (e: any) {
      setExplanation({ text: `Something went wrong: ${e?.message ?? e}`, done: true });
    }
  }

  function next() {
    if (index + 1 >= items.length) {
      onFinish({ ...result.current, total: items.length, ms: Date.now() - started.current });
      return;
    }
    setIndex(index + 1);
    setAttempt({ state: "answering", wrong: [] });
    setTyped("");
    setExplanation(null);
  }

  const explaining = explanation != null && !explanation.done;
  const options: { value: Response; label: string }[] =
    item.answer.kind === "mcq"
      ? (item.choices ?? []).map((label, i) => ({ value: i, label }))
      : item.answer.kind === "truefalse"
        ? [
            { value: true, label: "True" },
            { value: false, label: "False" },
          ]
        : [];

  return (
    <>
      <View style={styles.top}>
        <ProgressBar value={(index + (settled ? 1 : 0)) / items.length} track={colors.line} fill={colors.green700} />
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={type.eyebrow}>
          Question {index + 1} of {items.length} · {subStrandName}
        </Text>
        <Text style={type.question}>{item.prompt}</Text>

        <View style={styles.options}>
          {options.map((o, i) => {
            const state = optionState(item, o.value, attempt);
            return (
              <Pressable
                key={String(o.value)}
                onPress={() => submit(o.value)}
                disabled={settled || state === "tried"}
                accessibilityRole="button"
                accessibilityState={{ disabled: settled || state === "tried", selected: state === "right" }}
                accessibilityLabel={`${o.label}${state === "right" ? ", correct" : state === "tried" || state === "picked" ? ", not correct" : ""}`}
                style={[styles.option, OPTION[state].box]}
              >
                <View style={[styles.badge, OPTION[state].badge]}>
                  {state === "right" ? (
                    <Icon name="check" size={18} color={colors.surface} />
                  ) : state === "tried" || state === "picked" ? (
                    <Icon name="cross" size={16} color={colors.muted} />
                  ) : (
                    <Text style={styles.letter}>{LETTERS[i]}</Text>
                  )}
                </View>
                <Text style={[styles.optionText, OPTION[state].text]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {item.answer.kind === "numeric" && (
          <View style={styles.numericRow}>
            <TextInput
              style={styles.input}
              value={typed}
              onChangeText={setTyped}
              keyboardType="numeric"
              placeholder="Your answer"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Your answer"
              editable={!settled}
              onSubmitEditing={() => typed.trim() && submit(typed)}
            />
            <Button label="Check" onPress={() => submit(typed)} disabled={settled || !typed.trim()} style={styles.check} />
          </View>
        )}
      </ScrollView>

      {attempt.state === "answering" && attempt.wrong.length > 0 && (
        <View style={[styles.sheet, styles.sheetHint]}>
          <View style={styles.verdictRow}>
            <View style={[styles.verdictIcon, { backgroundColor: colors.sunSoft }]}>
              <Icon name="bulb" size={24} color={colors.sunText} />
            </View>
            <Text style={styles.verdict}>Not quite. Try again!</Text>
          </View>
          <Text style={type.body}>{item.hints?.[0]}</Text>
        </View>
      )}

      {attempt.state === "correct" && (
        <View style={[styles.sheet, styles.sheetCorrect]}>
          <View style={styles.verdictRow}>
            <View style={[styles.verdictIcon, { backgroundColor: colors.green700 }]}>
              <Icon name="check" size={24} color={colors.surface} />
            </View>
            <Text style={[styles.verdict, { color: colors.green900 }]}>Hongera!</Text>
            <Text style={styles.xpGain}>+{XP_PER_CORRECT} XP</Text>
          </View>
          <Text style={type.body}>{item.explanation}</Text>
          <Button label={index + 1 < items.length ? "Continue" : "Finish"} onPress={next} />
        </View>
      )}

      {attempt.state === "wrong" && (
        <View style={[styles.sheet, styles.sheetWrong]}>
          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetBody}>
            <Text style={type.eyebrow}>The answer is</Text>
            <Text style={styles.answer}>{correctAnswerText(item)}</Text>
            {explanation ? (
              <View style={styles.explanation}>
                <MwalimuAvatar size={32} />
                <View style={styles.flex}>
                  <AnswerBody text={explanation.text} question={item.prompt} />
                </View>
              </View>
            ) : (
              <Text style={type.body}>{item.explanation}</Text>
            )}
          </ScrollView>
          <View style={styles.sheetButtons}>
            {!explanation && <Button label="Ask Mwalimu why" variant="secondary" onPress={explain} style={styles.flex} />}
            <Button label={index + 1 < items.length ? "Continue" : "Finish"} onPress={next} disabled={explaining} style={styles.flex} />
          </View>
        </View>
      )}
    </>
  );
}

type OptionState = "idle" | "right" | "tried" | "picked" | "faded";

// "tried": wrong before the hint; "picked": the learner's final wrong answer.
function optionState(item: PracticeItem, value: Response, attempt: Attempt): OptionState {
  const tried = attempt.wrong.includes(value);
  if (attempt.state === "answering") return tried ? "tried" : "idle";
  if (value === item.answer.value) return "right";
  return tried ? "picked" : "faded";
}

const OPTION = {
  idle: { box: {}, badge: {}, text: {} },
  right: { box: { backgroundColor: colors.green100, borderColor: colors.green700, borderBottomColor: colors.green700 }, badge: { backgroundColor: colors.green700, borderColor: colors.green700 }, text: { fontFamily: fonts.body800, color: colors.green900 } },
  tried: { box: { opacity: 0.6 }, badge: {}, text: { textDecorationLine: "line-through" as const } },
  picked: { box: { borderColor: colors.muted, borderBottomColor: colors.muted }, badge: {}, text: { textDecorationLine: "line-through" as const } },
  faded: { box: { opacity: 0.55 }, badge: {}, text: {} },
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.xl, paddingTop: space.lg },
  body: { padding: space.xl, gap: 20 },
  options: { gap: space.md },
  option: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  badge: { width: 32, height: 32, borderRadius: 10, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  letter: { fontFamily: fonts.body800, fontSize: 14, color: colors.muted },
  optionText: { flex: 1, fontFamily: fonts.body700, fontSize: 17, lineHeight: 23, color: colors.ink },
  numericRow: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  input: {
    flex: 1,
    height: 56,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body700,
    fontSize: 18,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  check: { minWidth: 110 },
  sheet: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 14, borderTopWidth: 3 },
  sheetHint: { backgroundColor: colors.surface, borderTopColor: colors.sun400 },
  sheetCorrect: { backgroundColor: colors.green100, borderTopColor: colors.green700 },
  sheetWrong: { backgroundColor: colors.surface, borderTopColor: colors.line, maxHeight: "60%" },
  sheetScroll: { flexGrow: 0 },
  sheetBody: { gap: space.sm },
  sheetButtons: { flexDirection: "row", gap: 10 },
  verdictRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  verdictIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  verdict: { flex: 1, fontFamily: fonts.heading800, fontSize: 24, lineHeight: 30, color: colors.ink },
  answer: { fontFamily: fonts.heading800, fontSize: 24, lineHeight: 30, color: colors.ink },
  xpGain: {
    fontFamily: fonts.heading800,
    fontSize: 17,
    color: colors.sunText,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 2,
    overflow: "hidden",
  },
  explanation: { flexDirection: "row", gap: space.md, alignItems: "flex-start", marginTop: space.xs },
});
