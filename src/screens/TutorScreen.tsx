import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { PracticeItem } from "../assessment/mark";
import pack from "../packs/g7-sci/pack.json";
import { resolveModelPath } from "../tutor/model";
import { TutorSession, type PrepareStep } from "../tutor/session";
import AskView from "./AskView";
import QuizView from "./QuizView";
import { colors, radius, space } from "./theme";

const subStrands = pack.subStrands;
const subStrandNames = Object.fromEntries(subStrands.map((s) => [s.id, s.subStrand]));

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

// Practice items for a sub-strand, in authored order.
function practiceItems(subStrand: string): PracticeItem[] {
  const sloIds = new Set(subStrands.find((s) => s.id === subStrand)!.slos.map((slo) => slo.id));
  return pack.items.filter((it) => it.type === "practice" && it.slos.some((id) => sloIds.has(id))) as PracticeItem[];
}

export default function TutorScreen() {
  const session = useRef(new TutorSession(pack, resolveModelPath)).current;
  const [prepare, setPrepare] = useState<PrepareStep | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subStrand, setSubStrand] = useState(subStrands[0].id);
  const [tab, setTab] = useState<"ask" | "quiz">("ask");
  const items = useMemo(() => practiceItems(subStrand), [subStrand]);

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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>Mdarisi</Text>
          <Text style={styles.subtitle}>
            Grade {pack.manifest.grade} {pack.manifest.learningArea} · {current.strand}
          </Text>
          {subStrands.length > 1 && (
            <View style={styles.chips}>
              {subStrands.map((s) => (
                <Pressable key={s.id} onPress={() => setSubStrand(s.id)} style={[styles.chip, s.id === subStrand && styles.chipActive]}>
                  <Text style={[styles.chipText, s.id === subStrand && styles.chipTextActive]}>{s.subStrand}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Text style={styles.topic}>{current.subStrand}</Text>
          <View style={styles.tabs}>
            {(["ask", "quiz"] as const).map((t) => (
              <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t === "ask" ? "Ask" : "Quiz"}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Both stay mounted so switching tabs keeps the answer and quiz progress. */}
        <View style={[styles.flex, tab !== "ask" && styles.hidden]}>
          <AskView
            key={subStrand}
            session={session}
            subStrand={subStrand}
            subStrandNames={subStrandNames}
            suggestedQuestions={current.suggestedQuestions ?? []}
          />
        </View>
        <View style={[styles.flex, tab !== "quiz" && styles.hidden]}>
          <QuizView key={subStrand} session={session} subStrand={subStrand} items={items} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: "none" },
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: space.xl },
  title: { fontSize: 26, fontWeight: "700", color: colors.accent },
  tagline: { fontSize: 15, color: colors.muted, marginTop: space.xs, fontStyle: "italic" },
  prepareText: { fontSize: 16, color: colors.text, marginTop: space.lg, textAlign: "center", lineHeight: 22 },
  progressTrack: { width: "80%", height: 8, borderRadius: radius.pill, backgroundColor: colors.border, marginTop: space.md },
  progressFill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.accent },
  errorText: { fontSize: 16, color: colors.text, marginTop: space.lg, textAlign: "center" },
  header: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  subtitle: { fontSize: 14, color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextActive: { color: colors.accentText },
  topic: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: space.xs },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { paddingVertical: space.sm, paddingHorizontal: space.lg, borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: colors.accent },
  tabText: { fontSize: 16, color: colors.muted, fontWeight: "600" },
  tabTextActive: { color: colors.accent },
});
