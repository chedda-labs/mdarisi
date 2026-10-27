import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import type { QuizResult } from "./QuizView";
import { colors, fonts, radius, space } from "./theme";
import { Button, Icon } from "./ui";

// Static confetti: left %, top px, size, colour, rotation.
const CONFETTI: [number, number, number, number, string, number][] = [
  [10, 70, 12, 12, colors.sun400, 20],
  [82, 96, 10, 18, colors.flame, -25],
  [22, 220, 9, 9, colors.surface, 0],
  [77, 250, 14, 8, colors.sun400, 35],
  [49, 46, 8, 14, colors.mint, 10],
  [8, 300, 10, 16, colors.mint, -40],
  [87, 180, 9, 9, colors.surface, 0],
];

function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`;
}

export default function CompleteScreen({
  result,
  subStrandName,
  nextName,
  onNext,
  onRetry,
}: {
  result: QuizResult;
  subStrandName: string;
  nextName: string;
  onNext: () => void;
  onRetry: () => void;
}) {
  const tricky = result.tricky.length;
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      {CONFETTI.map(([left, top, w, h, color, rotate], i) => (
        <View key={i} style={{ position: "absolute", left: `${left}%`, top, width: w, height: h, borderRadius: 3, backgroundColor: color, transform: [{ rotate: `${rotate}deg` }] }} />
      ))}

      <View style={styles.top}>
        <View style={styles.hero}>
          <Icon name="star" size={96} color={colors.sun400} />
        </View>
        <View style={styles.headline}>
          <Text style={styles.title}>Lesson done!</Text>
          <Text style={styles.subtitle}>You finished {subStrandName}</Text>
        </View>

        <View style={styles.tiles}>
          <Tile label="XP" value={`+${result.xp}`} color={colors.sunText} />
          <Tile label="Correct" value={`${result.correct}/${result.total}`} color={colors.green700} />
          <Tile label="Time" value={duration(result.ms)} color={colors.ink} />
        </View>
      </View>

      <View style={styles.buttons}>
        <Button label={`Next lesson: ${nextName}`} variant="sun" onPress={onNext} />
        <Button label={tricky === 0 ? "Play again" : tricky === 1 ? "Retry the tricky one" : `Retry the ${tricky} tricky ones`} variant="secondaryOnGreen" onPress={onRetry} />
      </View>
    </SafeAreaView>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.green700, overflow: "hidden" },
  top: { flex: 1, alignItems: "center", paddingTop: 72, paddingHorizontal: space.xl, gap: 22 },
  hero: { width: 150, height: 150, borderRadius: 75, backgroundColor: colors.green900, alignItems: "center", justifyContent: "center" },
  headline: { alignItems: "center", gap: 4 },
  title: { fontFamily: fonts.heading800, fontSize: 40, lineHeight: 46, color: colors.sun400 },
  subtitle: { fontFamily: fonts.body600, fontSize: 16, color: colors.greenText, textAlign: "center" },
  tiles: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: space.md, alignItems: "center" },
  tileLabel: { fontFamily: fonts.body800, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: colors.muted },
  tileValue: { fontFamily: fonts.heading800, fontSize: 26, lineHeight: 32 },
  buttons: { paddingHorizontal: space.xl, paddingBottom: 32, gap: space.md },
});
