import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import type { PracticeItem } from "../assessment/mark";
import pack from "../packs/g7-sci/pack.json";
import { resolveModelPath } from "../tutor/model";
import { TutorSession, type PrepareStep } from "../tutor/session";
import AskView from "./AskView";
import CompleteScreen from "./CompleteScreen";
import LoadingScreen from "./LoadingScreen";
import QuizView, { type QuizResult } from "./QuizView";
import { colors, fonts, radius, space, type } from "./theme";
import { AppIcon, Wordmark, XpPill } from "./ui";

const QUIZ_LENGTH = 5;
const subStrands = pack.subStrands;
const lessonIds = subStrands.map((s) => s.id);
const subStrandNames = Object.fromEntries(subStrands.map((s) => [s.id, s.subStrand]));

// Practice items for a sub-strand, in authored order.
function practiceItems(subStrand: string): PracticeItem[] {
  const sloIds = new Set(subStrands.find((s) => s.id === subStrand)!.slos.map((slo) => slo.id));
  return pack.items.filter((it) => it.type === "practice" && it.slos.some((id) => sloIds.has(id))) as PracticeItem[];
}

// One suggested question a day for the opening screen.
function todaysMystery(): string | undefined {
  const all = subStrands.flatMap((s) => s.suggestedQuestions ?? []);
  const day = Math.floor(Date.now() / 86_400_000);
  return all.length ? all[day % all.length] : undefined;
}

export default function TutorScreen() {
  const session = useRef(new TutorSession(pack, resolveModelPath)).current;
  const mystery = useMemo(todaysMystery, []);
  const [prepare, setPrepare] = useState<PrepareStep | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subStrand, setSubStrand] = useState(subStrands[0].id);
  const [tab, setTab] = useState<"ask" | "quiz">("ask");
  const [xp, setXp] = useState(0);
  // A new run remounts the quiz; a retry runs only the items missed first time.
  const [quizRun, setQuizRun] = useState({ n: 0, items: null as PracticeItem[] | null });
  const [result, setResult] = useState<QuizResult | null>(null);
  const [keyboard, setKeyboard] = useState(0);
  const quizItems = useMemo(() => quizRun.items ?? practiceItems(subStrand).slice(0, QUIZ_LENGTH), [quizRun, subStrand]);

  useEffect(() => {
    session
      .prepare(lessonIds, setPrepare)
      .then((timings) => {
        console.log(`[prepare] ${JSON.stringify(timings)}`);
        setReady(true);
        session.embedding.then((ms) => console.log(`[prepare] ${JSON.stringify({ loadEmbed: ms })}`)).catch(() => {});
      })
      .catch((e: any) => setError(e?.message ?? String(e)));

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") void session.suspend().catch(() => {});
      if (state === "active") void session.resume().catch(() => {});
    });
    return () => sub.remove();
  }, [session]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (!ready || error) {
    return <LoadingScreen step={prepare} error={error} lessons={lessonIds} names={subStrandNames} mystery={mystery} />;
  }

  const current = subStrands.find((s) => s.id === subStrand)!;
  const nextId = lessonIds[(lessonIds.indexOf(subStrand) + 1) % lessonIds.length];
  const addXp = (n: number) => setXp((x) => x + n);

  function openLesson(id: string) {
    setSubStrand(id);
    setQuizRun((r) => ({ n: r.n + 1, items: null }));
    setResult(null);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      {/* Edge-to-edge Android doesn't resize the window for the keyboard, and
          KeyboardAvoidingView left a gap after it closed, so pad by its height.
          The header hides while typing so the chat keeps some room. */}
      <View style={[styles.flex, keyboard > 0 && { paddingBottom: keyboard }]}>
        <View style={[styles.header, keyboard > 0 && styles.hidden]}>
          <View style={styles.brandRow}>
            <AppIcon size={34} />
            <Wordmark size={24} color={colors.ink} />
            <View style={styles.flex} />
            <XpPill xp={xp} />
          </View>
          <Text style={type.eyebrow}>
            Grade {pack.manifest.grade} · {pack.manifest.learningArea}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {subStrands.map((s) => {
              const active = s.id === subStrand;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => active || openLesson(s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.subStrand}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.tabs} accessibilityRole="tablist">
            {(["ask", "quiz"] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t }}
                style={[styles.tab, tab === t && styles.tabActive]}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t === "ask" ? "Ask Mwalimu" : "Quiz"}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Both stay mounted so switching tabs keeps the chat and quiz progress. */}
        <View style={[styles.flex, tab !== "ask" && styles.hidden]}>
          <AskView
            key={subStrand}
            session={session}
            subStrand={subStrand}
            subStrandNames={subStrandNames}
            suggestedQuestions={current.suggestedQuestions ?? []}
            onXp={addXp}
          />
        </View>
        <View style={[styles.flex, tab !== "quiz" && styles.hidden]}>
          <QuizView
            key={`${subStrand}-${quizRun.n}`}
            session={session}
            subStrand={subStrand}
            subStrandName={current.subStrand}
            items={quizItems}
            onXp={addXp}
            onFinish={setResult}
          />
        </View>
      </View>

      {result && (
        <View style={StyleSheet.absoluteFill}>
          <CompleteScreen
            result={result}
            subStrandName={current.subStrand}
            nextName={subStrandNames[nextId]}
            onNext={() => openLesson(nextId)}
            onRetry={() => {
              setQuizRun((r) => ({ n: r.n + 1, items: result.tricky.length ? result.tricky : null }));
              setResult(null);
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: "none" },
  safe: { flex: 1, backgroundColor: colors.ground },
  header: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md, gap: 10 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  chips: { gap: space.sm },
  chip: {
    height: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.green700, borderColor: colors.green700 },
  chipText: { fontFamily: fonts.body800, fontSize: 14, color: colors.ink },
  chipTextActive: { color: colors.surface },
  tabs: { flexDirection: "row", backgroundColor: colors.line, borderRadius: radius.md, padding: 4 },
  tab: { flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: colors.surface, borderBottomWidth: 3, borderBottomColor: colors.green700 },
  tabText: { fontFamily: fonts.heading800, fontSize: 17, color: colors.muted },
  tabTextActive: { color: colors.green900 },
});
