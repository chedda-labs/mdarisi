import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { Answer, TutorSession } from "../tutor/session";
import AnswerBody from "./AnswerBody";
import { colors, radius, space } from "./theme";

type Turn = { question: string; text: string; done?: Answer };

export default function AskView({
  session,
  subStrand,
  suggestedQuestions,
}: {
  session: TutorSession;
  subStrand: string;
  suggestedQuestions: string[];
}) {
  const [question, setQuestion] = useState("");
  const [turn, setTurn] = useState<Turn | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [showTimings, setShowTimings] = useState(false);

  const answering = turn != null && turn.done == null;
  const fallback = turn?.done?.kind === "fallback";

  async function ask(q: string) {
    const text = q.trim();
    if (!text || answering) return;
    setQuestion("");
    setShowSources(false);
    setTurn({ question: text, text: "" });
    try {
      const done = await session.ask(subStrand, text, (partial) => setTurn({ question: text, text: partial }));
      setTurn({ question: text, text: done.text, done });
    } catch (e: any) {
      setTurn({
        question: text,
        text: "",
        done: { kind: "fallback", text: `Something went wrong: ${e?.message ?? e}`, sources: [], relevance: 0, timings: { relevanceMs: 0, totalMs: 0 } },
      });
    }
  }

  return (
    <>
      <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!turn && (
          <>
            <Text style={styles.hint}>Ask a question about this lesson, or try one of these:</Text>
            {suggestedQuestions.map((q) => (
              <Pressable key={q} onPress={() => ask(q)} style={styles.suggestion}>
                <Text style={styles.suggestionText}>{q}</Text>
              </Pressable>
            ))}
          </>
        )}

        {turn && (
          <>
            <Text style={styles.question}>{turn.question}</Text>
            <Pressable onLongPress={() => setShowTimings((v) => !v)} style={[styles.answer, fallback && styles.answerFallback]}>
              <AnswerBody text={turn.done?.text ?? turn.text} question={turn.question} muted={fallback} />
              {showTimings && turn.done && (
                <Text style={styles.timings}>
                  relevance {turn.done.timings.relevanceMs} ms · first word {turn.done.timings.firstWordMs ?? "-"} ms · total{" "}
                  {turn.done.timings.totalMs} ms · read {turn.done.timings.promptTokens ?? "-"} tokens
                </Text>
              )}
            </Pressable>

            {turn.done && turn.done.sources.length > 0 && (
              <Pressable onPress={() => setShowSources((v) => !v)} style={styles.sourcesToggle}>
                <Text style={styles.sourcesToggleText}>{showSources ? "Hide" : "From the lesson"}</Text>
              </Pressable>
            )}
            {showSources &&
              turn.done?.sources.map((s) => (
                <Text key={s.title} style={styles.source}>
                  • {s.title}
                </Text>
              ))}
          </>
        )}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={question}
          onChangeText={setQuestion}
          placeholder="Type your question"
          placeholderTextColor={colors.muted}
          returnKeyType="send"
          onSubmitEditing={() => ask(question)}
          editable={!answering}
          maxLength={200}
        />
        <Pressable
          onPress={() => ask(question)}
          disabled={answering || !question.trim()}
          style={[styles.askButton, (answering || !question.trim()) && styles.askButtonDisabled]}
        >
          <Text style={styles.askText}>{answering ? "…" : "Ask"}</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.md },
  hint: { fontSize: 16, color: colors.muted, lineHeight: 22 },
  suggestion: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md },
  suggestionText: { fontSize: 16, color: colors.accent, fontWeight: "600" },
  question: { fontSize: 17, fontWeight: "600", color: colors.text },
  answer: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.lg, gap: space.md },
  answerFallback: { backgroundColor: colors.fallback, borderColor: colors.fallback },
  timings: { fontSize: 12, color: colors.muted },
  sourcesToggle: { alignSelf: "flex-start", paddingVertical: space.xs },
  sourcesToggleText: { fontSize: 15, color: colors.accent, fontWeight: "600", textDecorationLine: "underline" },
  source: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  inputBar: { flexDirection: "row", gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, fontSize: 17, color: colors.text, backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  askButton: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: space.lg, justifyContent: "center", minWidth: 64, alignItems: "center" },
  askButtonDisabled: { opacity: 0.4 },
  askText: { color: colors.accentText, fontSize: 17, fontWeight: "700" },
});
