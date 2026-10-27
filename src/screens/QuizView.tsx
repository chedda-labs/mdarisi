import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { correctAnswerText, isCorrect, responseText, type PracticeItem, type Response } from "../assessment/mark";
import { explainRequest } from "../tutor/prompt";
import type { TutorSession } from "../tutor/session";
import AnswerBody from "./AnswerBody";
import { colors, radius, space } from "./theme";

const QUIZ_LENGTH = 5;

// One wrong answer gets the authored hint and another try; a second wrong
// answer reveals the correct one and offers "Explain" from the tutor.
type Attempt =
  | { state: "answering"; tries: number }
  | { state: "correct" }
  | { state: "wrong"; response: Response };

export default function QuizView({ session, subStrand, items }: { session: TutorSession; subStrand: string; items: PracticeItem[] }) {
  const quiz = useMemo(() => items.slice(0, QUIZ_LENGTH), [items]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [attempt, setAttempt] = useState<Attempt>({ state: "answering", tries: 0 });
  const [typed, setTyped] = useState("");
  const [explanation, setExplanation] = useState<{ text: string; done: boolean } | null>(null);

  const item = quiz[index];
  const finished = index >= quiz.length;

  function submit(response: Response) {
    if (attempt.state !== "answering") return;
    if (isCorrect(item, response)) {
      if (attempt.tries === 0) setScore((s) => s + 1);
      setAttempt({ state: "correct" });
    } else if (attempt.tries === 0 && item.hints?.length) {
      setAttempt({ state: "answering", tries: 1 });
    } else {
      setAttempt({ state: "wrong", response });
    }
  }

  async function explain(response: Response) {
    setExplanation({ text: "", done: false });
    const request = explainRequest({
      prompt: item.prompt,
      learnerAnswer: responseText(item, response),
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

  function goTo(i: number) {
    setIndex(i);
    setAttempt({ state: "answering", tries: 0 });
    setTyped("");
    setExplanation(null);
  }

  const next = () => goTo(index + 1);

  function restart() {
    setScore(0);
    goTo(0);
  }

  if (finished) {
    return (
      <View style={styles.body}>
        <Text style={styles.progress}>Quiz finished</Text>
        <Text style={styles.score}>
          {score} out of {quiz.length} right first time
        </Text>
        <Pressable onPress={restart} style={styles.primary}>
          <Text style={styles.primaryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const answered = attempt.state !== "answering";
  const explaining = explanation != null && !explanation.done;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.progress}>
        Question {index + 1} of {quiz.length}
      </Text>
      <Text style={styles.prompt}>{item.prompt}</Text>

      {item.answer.kind === "mcq" &&
        item.choices?.map((choice, i) => (
          <Pressable key={choice} onPress={() => submit(i)} disabled={answered} style={choiceStyle(item, i, attempt)}>
            <Text style={styles.choiceText}>{choice}</Text>
          </Pressable>
        ))}

      {item.answer.kind === "truefalse" && (
        <View style={styles.row}>
          {[true, false].map((v) => (
            <Pressable key={String(v)} onPress={() => submit(v)} disabled={answered} style={[choiceStyle(item, v, attempt), styles.half]}>
              <Text style={styles.choiceText}>{v ? "True" : "False"}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {item.answer.kind === "numeric" && (
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={typed}
            onChangeText={setTyped}
            keyboardType="numeric"
            placeholder="Your answer"
            placeholderTextColor={colors.muted}
            editable={!answered}
            onSubmitEditing={() => typed.trim() && submit(typed)}
          />
          <Pressable onPress={() => submit(typed)} disabled={answered || !typed.trim()} style={[styles.primary, (answered || !typed.trim()) && styles.disabled]}>
            <Text style={styles.primaryText}>Check</Text>
          </Pressable>
        </View>
      )}

      {attempt.state === "answering" && attempt.tries === 1 && (
        <View style={styles.hintBox}>
          <Text style={styles.feedbackTitle}>Not quite. Hint:</Text>
          <Text style={styles.feedbackText}>{item.hints?.[0]}</Text>
        </View>
      )}

      {attempt.state === "correct" && (
        <View style={styles.correctBox}>
          <Text style={styles.feedbackTitle}>Correct!</Text>
          <Text style={styles.feedbackText}>{item.explanation}</Text>
        </View>
      )}

      {attempt.state === "wrong" && (
        <View style={styles.wrongBox}>
          <Text style={styles.feedbackTitle}>The answer is: {correctAnswerText(item)}</Text>
          {!explanation && (
            <Pressable onPress={() => explain(attempt.response)} style={styles.secondary}>
              <Text style={styles.secondaryText}>Explain</Text>
            </Pressable>
          )}
          {explanation && <AnswerBody text={explanation.text} question={item.prompt} />}
        </View>
      )}

      {answered && (
        <Pressable onPress={next} disabled={explaining} style={[styles.primary, explaining && styles.disabled]}>
          <Text style={styles.primaryText}>{index + 1 < quiz.length ? "Next question" : "See my score"}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

// Highlight the right choice once the item is settled, and the learner's wrong pick.
function choiceStyle(item: PracticeItem, value: number | boolean, attempt: Attempt) {
  if (attempt.state === "answering") return styles.choice;
  if (value === item.answer.value) return [styles.choice, styles.choiceRight];
  if (attempt.state === "wrong" && attempt.response === value) return [styles.choice, styles.choiceWrong];
  return [styles.choice, styles.disabled];
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.md },
  progress: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  prompt: { fontSize: 19, fontWeight: "600", color: colors.text, lineHeight: 26 },
  score: { fontSize: 22, fontWeight: "700", color: colors.text },
  row: { flexDirection: "row", gap: space.sm },
  half: { flex: 1 },
  choice: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md },
  choiceRight: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  choiceWrong: { backgroundColor: colors.wrongSoft, borderColor: colors.wrong },
  choiceText: { fontSize: 17, color: colors.text },
  disabled: { opacity: 0.5 },
  input: { flex: 1, fontSize: 17, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md },
  hintBox: { backgroundColor: colors.check, borderWidth: 1, borderColor: colors.checkBorder, borderRadius: radius.md, padding: space.md, gap: space.xs },
  correctBox: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: space.md, gap: space.xs },
  wrongBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, gap: space.md },
  feedbackTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  feedbackText: { fontSize: 16, color: colors.text, lineHeight: 23 },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.accentText, fontSize: 17, fontWeight: "700" },
  secondary: { alignSelf: "flex-start", borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  secondaryText: { color: colors.accent, fontSize: 16, fontWeight: "700" },
});
