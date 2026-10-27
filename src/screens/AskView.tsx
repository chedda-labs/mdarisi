import React, { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { Answer, TutorSession } from "../tutor/session";
import AnswerBody from "./AnswerBody";
import { colors, fonts, radius, space, type } from "./theme";
import { Icon, MwalimuAvatar } from "./ui";

export const XP_PER_QUESTION = 5;

type Turn = { question: string; text: string; done?: Answer };

export default function AskView({
  session,
  subStrand,
  subStrandNames,
  suggestedQuestions,
  onXp,
}: {
  session: TutorSession;
  subStrand: string;
  subStrandNames: Record<string, string>;
  suggestedQuestions: string[];
  onXp: (xp: number) => void;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const scroll = useRef<ScrollView>(null);

  const answering = turns.length > 0 && turns[turns.length - 1].done == null;
  const asked = new Set(turns.map((t) => t.question));
  const suggestions = suggestedQuestions.filter((q) => !asked.has(q)).slice(0, 3);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || answering) return;
    setQuestion("");
    const update = (turn: Turn) => setTurns((ts) => [...ts.slice(0, -1), turn]);
    setTurns((ts) => [...ts, { question: text, text: "" }]);
    try {
      const done = await session.ask(subStrand, text, (partial) => update({ question: text, text: partial }));
      update({ question: text, text: done.text, done });
      if (done.kind === "answer") onXp(XP_PER_QUESTION);
    } catch (e: any) {
      update({
        question: text,
        text: "",
        done: { kind: "fallback", text: `Something went wrong: ${e?.message ?? e}`, sources: [], relevance: 0, subStrand, timings: { relevanceMs: 0, totalMs: 0 } },
      });
    }
  }

  return (
    <>
      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.chat}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {/* Part of the chat rather than a fixed bar, so it scrolls away and leaves room. */}
        <View style={styles.mwalimuRow}>
          <MwalimuAvatar size={40} />
          <Text style={styles.name}>Mwalimu</Text>
        </View>
        <View style={[styles.bubble, styles.mwalimu]}>
          <Text style={type.body}>
            Habari! Ask me anything about {subStrandNames[subStrand].toLowerCase()}. I answer from your lesson, and I’ll tell you when I don’t know.
          </Text>
        </View>
        {turns.map((turn, i) => (
          <TurnView key={i} turn={turn} subStrand={subStrand} subStrandNames={subStrandNames} />
        ))}
      </ScrollView>

      {!answering && suggestions.length > 0 && (
        <View style={styles.chips}>
          {suggestions.map((q) => (
            <Pressable key={q} onPress={() => ask(q)} style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]} accessibilityRole="button">
              <Text style={styles.chipText}>{q}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={question}
          onChangeText={setQuestion}
          placeholder="Ask anything…"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Ask Mwalimu a question"
          returnKeyType="send"
          onSubmitEditing={() => ask(question)}
          editable={!answering}
          maxLength={200}
        />
        <Pressable
          onPress={() => ask(question)}
          disabled={answering || !question.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send question"
          style={[styles.send, (answering || !question.trim()) && styles.sendDisabled]}
        >
          {({ pressed }) => (
            <View style={[styles.sendFace, { marginTop: pressed ? 3 : 0, marginBottom: pressed ? 0 : 3 }]}>
              <Icon name="send" size={24} />
            </View>
          )}
        </Pressable>
      </View>
    </>
  );
}

function TurnView({ turn, subStrand, subStrandNames }: { turn: Turn; subStrand: string; subStrandNames: Record<string, string> }) {
  const [showSources, setShowSources] = useState(false);
  const [showTimings, setShowTimings] = useState(false);
  const done = turn.done;
  const fallback = done?.kind === "fallback";
  const answeredFrom = done?.kind === "answer" && done.subStrand !== subStrand ? subStrandNames[done.subStrand] : null;

  return (
    <>
      <View style={[styles.bubble, styles.learner]}>
        <Text style={[type.body, styles.learnerText]}>{turn.question}</Text>
      </View>
      {/* Long-press shows the timings, for checking speed on the phone. */}
      <Pressable onLongPress={() => setShowTimings((v) => !v)} style={[styles.bubble, styles.mwalimu]}>
        {answeredFrom && <Text style={type.caption}>From the {answeredFrom} lesson</Text>}
        <AnswerBody text={done?.text ?? turn.text} question={turn.question} muted={fallback} />
        {done?.kind === "answer" && (
          <View style={styles.footer}>
            <View style={styles.xp}>
              <Icon name="star" size={16} color={colors.sun400} />
              <Text style={styles.xpText}>+{XP_PER_QUESTION} XP for asking</Text>
            </View>
            {done.sources.length > 0 && (
              <Pressable onPress={() => setShowSources((v) => !v)} hitSlop={12} accessibilityRole="button">
                <Text style={styles.sourcesToggle}>{showSources ? "Hide" : "From the lesson"}</Text>
              </Pressable>
            )}
          </View>
        )}
        {showSources &&
          done?.sources.map((s) => (
            <Text key={s.title} style={styles.source}>
              • {s.title}
            </Text>
          ))}
        {showTimings && done && (
          <Text style={type.caption}>
            relevance {done.timings.relevanceMs} ms · first word {done.timings.firstWordMs ?? "-"} ms · total {done.timings.totalMs} ms · read{" "}
            {done.timings.promptTokens ?? "-"} tokens
          </Text>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mwalimuRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  name: { fontFamily: fonts.heading800, fontSize: 21, lineHeight: 24, color: colors.ink },
  chat: { padding: space.lg, gap: space.md },
  bubble: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  learner: { alignSelf: "flex-end", maxWidth: "80%", backgroundColor: colors.green700, borderRadius: 20, borderBottomRightRadius: 6 },
  learnerText: { color: colors.surface },
  mwalimu: {
    alignSelf: "flex-start",
    maxWidth: "88%",
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    borderBottomWidth: 2,
    borderBottomColor: colors.line,
  },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  xp: { flexDirection: "row", alignItems: "center", gap: 6 },
  xpText: { fontFamily: fonts.body800, fontSize: 13, color: colors.sunText },
  sourcesToggle: { fontFamily: fonts.body800, fontSize: 13, color: colors.green700, textDecorationLine: "underline" },
  source: { fontFamily: fonts.body600, fontSize: 14, lineHeight: 20, color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  chip: {
    minHeight: 40,
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 20,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipPressed: { borderColor: colors.green700 },
  chipText: { fontFamily: fonts.body800, fontSize: 14, color: colors.ink },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 2,
    borderTopColor: colors.line,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body600,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.ground,
  },
  send: { borderRadius: radius.md, backgroundColor: colors.sun600 },
  sendDisabled: { opacity: 0.45 },
  sendFace: { width: 50, height: 47, borderRadius: radius.md, backgroundColor: colors.sun400, alignItems: "center", justifyContent: "center" },
});
