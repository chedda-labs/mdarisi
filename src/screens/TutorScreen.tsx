import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import pack from "../packs/g7-sci/pack.json";
import { TutorSession, type Answer, type PrepareStep } from "../tutor/session";
import { colors, radius, space } from "./theme";

const subStrands = pack.subStrands;

function prepareLabel(s: PrepareStep): string {
  switch (s.step) {
    case "copy":
      return `Unpacking the tutor, first launch only (${s.percentage}%)`;
    case "load":
      return "Starting the tutor";
    case "read": {
      const name = subStrands.find((ss) => ss.id === s.subStrand)?.subStrand ?? s.subStrand;
      return `Reading the lesson: ${name}. The first launch takes about a minute.`;
    }
  }
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// The tutor ends each answer with a line starting "Check:"; show it apart.
// The small model sometimes just repeats the learner's question there, which
// reads as a glitch, so that case is dropped.
function splitCheck(text: string, question: string): { body: string; check?: string } {
  const i = text.indexOf("Check:");
  if (i < 0) return { body: text.trim() };
  const check = text.slice(i + "Check:".length).trim();
  return { body: text.slice(0, i).trim(), check: normalise(check) === normalise(question) ? undefined : check };
}

type Turn = { question: string; text: string; done?: Answer };

export default function TutorScreen() {
  const session = useRef(new TutorSession(pack)).current;
  const [prepare, setPrepare] = useState<PrepareStep | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subStrand, setSubStrand] = useState(subStrands[0].id);
  const [question, setQuestion] = useState("");
  const [turn, setTurn] = useState<Turn | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [showTimings, setShowTimings] = useState(false);

  useEffect(() => {
    session
      .prepare(
        subStrands.map((s) => s.id),
        setPrepare,
      )
      .then(() => setReady(true))
      .catch((e: any) => setError(e?.message ?? String(e)));

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") void session.suspend().catch(() => {});
      if (state === "active") void session.resume().catch(() => {});
    });
    return () => sub.remove();
  }, [session]);

  const answering = turn != null && turn.done == null;

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
        done: { kind: "fallback", text: `Something went wrong: ${e?.message ?? e}`, sources: [], timings: { relevanceMs: 0, totalMs: 0 } },
      });
    }
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Mdarisi</Text>
        <Text style={styles.errorText}>The tutor could not start: {error}</Text>
      </SafeAreaView>
    );
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Mdarisi</Text>
        <Text style={styles.tagline}>Mwalimu mfukoni, hata bila mtandao</Text>
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: space.xl }} />
        <Text style={styles.prepareText}>{prepare ? prepareLabel(prepare) : "Getting ready"}</Text>
        {prepare?.step === "copy" && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${prepare.percentage}%` }]} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  const current = subStrands.find((s) => s.id === subStrand)!;
  const { body, check } = splitCheck(turn?.text ?? "", turn?.question ?? "");
  const fallback = turn?.done?.kind === "fallback";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>Mdarisi</Text>
          <Text style={styles.subtitle}>
            Grade {pack.manifest.grade} {pack.manifest.learningArea} · {current.strand}
          </Text>
        </View>

        {subStrands.length > 1 && (
          <ScrollView horizontal style={styles.chipsRow} contentContainerStyle={styles.chips}>
            {subStrands.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setSubStrand(s.id)}
                disabled={answering}
                style={[styles.chip, s.id === subStrand && styles.chipActive]}
              >
                <Text style={[styles.chipText, s.id === subStrand && styles.chipTextActive]}>{s.subStrand}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.topic}>{current.subStrand}</Text>

          {!turn && (
            <>
              <Text style={styles.hint}>Ask a question about this lesson, or try one of these:</Text>
              {current.suggestedQuestions?.map((q) => (
                <Pressable key={q} onPress={() => ask(q)} style={styles.suggestion}>
                  <Text style={styles.suggestionText}>{q}</Text>
                </Pressable>
              ))}
            </>
          )}

          {turn && (
            <>
              <Text style={styles.question}>{turn.question}</Text>
              <Pressable
                onLongPress={() => setShowTimings((v) => !v)}
                style={[styles.answer, fallback && styles.answerFallback]}
              >
                {!turn.text && <ActivityIndicator color={colors.accent} />}
                {!!body && <Text style={[styles.answerText, fallback && styles.fallbackText]}>{body}</Text>}
                {!!check && (
                  <View style={styles.check}>
                    <Text style={styles.checkLabel}>Check yourself</Text>
                    <Text style={styles.answerText}>{check}</Text>
                  </View>
                )}
                {showTimings && turn.done && (
                  <Text style={styles.timings}>
                    relevance {turn.done.timings.relevanceMs} ms · first word{" "}
                    {turn.done.timings.firstWordMs ?? "-"} ms · total {turn.done.timings.totalMs} ms · read{" "}
                    {turn.done.timings.promptTokens ?? "-"} tokens
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: space.xl },
  title: { fontSize: 26, fontWeight: "700", color: colors.accent },
  tagline: { fontSize: 15, color: colors.muted, marginTop: space.xs, fontStyle: "italic" },
  prepareText: { fontSize: 16, color: colors.text, marginTop: space.lg, textAlign: "center", lineHeight: 22 },
  progressTrack: { width: "80%", height: 8, borderRadius: radius.pill, backgroundColor: colors.border, marginTop: space.md },
  progressFill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.accent },
  errorText: { fontSize: 16, color: colors.text, marginTop: space.lg, textAlign: "center" },
  header: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 2 },
  chipsRow: { flexGrow: 0 },
  chips: { paddingHorizontal: space.lg, gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextActive: { color: colors.accentText },
  body: { padding: space.lg, gap: space.md },
  topic: { fontSize: 20, fontWeight: "700", color: colors.text },
  hint: { fontSize: 16, color: colors.muted, lineHeight: 22 },
  suggestion: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md },
  suggestionText: { fontSize: 16, color: colors.accent, fontWeight: "600" },
  question: { fontSize: 17, fontWeight: "600", color: colors.text },
  answer: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.lg, gap: space.md },
  answerFallback: { backgroundColor: colors.fallback, borderColor: colors.fallback },
  answerText: { fontSize: 17, color: colors.text, lineHeight: 25 },
  fallbackText: { color: colors.fallbackText },
  check: { backgroundColor: colors.check, borderWidth: 1, borderColor: colors.checkBorder, borderRadius: radius.sm, padding: space.md, gap: space.xs },
  checkLabel: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
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
