import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import type { PrepareStep } from "../tutor/session";
import { colors, fonts, radius, type } from "./theme";
import { AppIcon, Icon, ProgressBar, useReduceMotion, Wordmark } from "./ui";

// How far along start-up is, from the step that just began: copying the
// models (first launch only), loading the tutor, then reading each lesson.
function progress(step: PrepareStep | null, lessons: string[]): number {
  if (!step) return 0.02;
  switch (step.step) {
    case "copy":
      return 0.05 + (step.model === "tutor" ? 0.15 : 0.3) * (step.percentage / 100);
    case "load":
      return 0.38;
    case "read":
      return 0.42 + (0.55 * lessons.indexOf(step.subStrand)) / lessons.length;
  }
}

function statusLine(step: PrepareStep | null, names: Record<string, string>, lessons: string[]): string {
  if (!step) return "Getting ready…";
  switch (step.step) {
    case "copy":
      return `Unpacking Mwalimu… ${step.percentage}%`;
    case "load":
      return "Waking Mwalimu up…";
    case "read":
      return `Reading the ${names[step.subStrand]} lesson (${lessons.indexOf(step.subStrand) + 1} of ${lessons.length})…`;
  }
}

// A first read takes about 40 s; re-reading the cached lesson takes 1–2 s,
// or up to 12 s on a slow start.
const SLOW_READ_MS = 15000;

export default function LoadingScreen({
  step,
  error,
  lessons,
  names,
  mystery,
}: {
  step: PrepareStep | null;
  error: string | null;
  lessons: string[];
  names: Record<string, string>;
  mystery?: string;
}) {
  const reduceMotion = useReduceMotion();
  const bounce = useRef(new Animated.Value(0)).current;
  const [slowRead, setSlowRead] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -12, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, reduceMotion]);

  const reading = step?.step === "read" ? step.subStrand : null;
  useEffect(() => {
    setSlowRead(false);
    if (!reading) return;
    const t = setTimeout(() => setSlowRead(true), SLOW_READ_MS);
    return () => clearTimeout(t);
  }, [reading]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <View style={styles.top}>
        <Animated.View style={{ transform: [{ translateY: bounce }] }}>
          <AppIcon size={112} gold shadow />
        </Animated.View>
        <Wordmark size={46} color={colors.surface} />
        <Text style={styles.tagline}>Mwalimu mfukoni, hata bila mtandao</Text>

        {mystery && !error && (
          <View style={styles.mystery}>
            <View style={styles.mysteryHead}>
              <View style={styles.mysteryIcon}>
                <Icon name="bulb" size={20} color={colors.sunText} />
              </View>
              <Text style={type.eyebrow}>Today’s mystery</Text>
            </View>
            <Text style={styles.mysteryQuestion}>{mystery}</Text>
            <Text style={styles.mysteryHint}>Ask Mwalimu once we’re ready</Text>
          </View>
        )}
      </View>

      <View style={styles.bottom}>
        {error ? (
          <Text style={styles.status}>Mwalimu could not start: {error}</Text>
        ) : (
          <>
            <Text style={styles.status} accessibilityLiveRegion="polite">
              {statusLine(step, names, lessons)}
            </Text>
            <View style={styles.barRow}>
              <ProgressBar value={progress(step, lessons)} track={colors.green900} fill={colors.sun400} />
            </View>
            {slowRead && (
              <Text style={styles.note}>The first launch after installing is slower while Mwalimu reads each lesson. After that, Mdarisi opens in seconds.</Text>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.green700, overflow: "hidden" },
  blob: { position: "absolute", borderRadius: 999 },
  blobTop: { left: -60, top: -60, width: 220, height: 220, backgroundColor: colors.green500 },
  blobBottom: { right: -120, bottom: -40, width: 260, height: 260, backgroundColor: colors.green900 },
  top: { flex: 1, alignItems: "center", paddingTop: 72, paddingHorizontal: 28, gap: 14 },
  tagline: { fontFamily: fonts.body700, fontSize: 15, color: colors.greenText, fontStyle: "italic" },
  mystery: {
    alignSelf: "stretch",
    marginTop: 26,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 20,
    gap: 10,
    borderBottomWidth: 6,
    borderBottomColor: colors.green900,
  },
  mysteryHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  mysteryIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.sunSoft, alignItems: "center", justifyContent: "center" },
  mysteryQuestion: { fontFamily: fonts.heading800, fontSize: 24, lineHeight: 29, color: colors.ink },
  mysteryHint: { fontFamily: fonts.body700, fontSize: 15, color: colors.green900 },
  bottom: { paddingHorizontal: 28, paddingBottom: 36, gap: 10 },
  status: { fontFamily: fonts.heading700, fontSize: 18, color: colors.surface },
  barRow: { flexDirection: "row" },
  note: { fontFamily: fonts.body600, fontSize: 14, lineHeight: 20, color: colors.greenText },
});
