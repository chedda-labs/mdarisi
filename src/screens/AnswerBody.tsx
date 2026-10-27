import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, radius, space } from "./theme";

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

export default function AnswerBody({ text, question, muted }: { text: string; question: string; muted?: boolean }) {
  const { body, check } = splitCheck(text, question);
  return (
    <>
      {!text && <ActivityIndicator color={colors.accent} />}
      {!!body && <Text style={[styles.text, muted && styles.muted]}>{body}</Text>}
      {!!check && (
        <View style={styles.check}>
          <Text style={styles.checkLabel}>Check yourself</Text>
          <Text style={styles.text}>{check}</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 17, color: colors.text, lineHeight: 25 },
  muted: { color: colors.fallbackText },
  check: { backgroundColor: colors.check, borderWidth: 1, borderColor: colors.checkBorder, borderRadius: radius.sm, padding: space.md, gap: space.xs },
  checkLabel: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
});
