import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, radius, space, type } from "./theme";

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
      {!text && <ActivityIndicator color={colors.green700} style={styles.waiting} />}
      {!!body && <Text style={[type.body, muted && styles.muted]}>{body}</Text>}
      {!!check && (
        <View style={styles.check}>
          <Text style={[type.eyebrow, styles.checkLabel]}>Check yourself</Text>
          <Text style={type.body}>{check}</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  waiting: { alignSelf: "flex-start" },
  muted: { color: colors.muted },
  check: { backgroundColor: colors.sunSoft, borderRadius: radius.sm, padding: space.md, gap: 2 },
  checkLabel: { fontSize: 12 },
});
