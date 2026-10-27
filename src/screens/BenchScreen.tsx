import React, { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { runBench } from "../bench/runBench";
import { runCacheTest } from "../bench/runCacheTest";
import { runEval } from "../eval/runEval";
import pack from "../packs/g7-sci/pack.json";
import { resolveModelPath } from "../tutor/model";
import { TutorSession } from "../tutor/session";

const TITLES = { bench: "model bake-off", cache: "cache test", eval: "test set" };

// The test set runs in the release app's own session, so its numbers match what a learner sees.
function runTestSet(onStatus: (s: string) => void) {
  const session = new TutorSession(pack, resolveModelPath);
  return runEval(session, (record) => console.log(`[eval] ${JSON.stringify({ t: Date.now(), ...record })}`), onStatus);
}

// Benchmarks and the test set write JSON lines to logcat; see README "Benchmarks".
export default function BenchScreen({ which }: { which: keyof typeof TITLES }) {
  const [status, setStatus] = useState("Starting…");

  useEffect(() => {
    const run = { bench: runBench, cache: runCacheTest, eval: runTestSet }[which];
    run(setStatus).catch((e: any) => {
      console.error("[bench]", e);
      setStatus(`Error: ${e?.message ?? String(e)}`);
    });
  }, [which]);

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.h1}>Mdarisi {TITLES[which]}</Text>
      <Text style={styles.status}>{status}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0B0F", padding: 16, gap: 12 },
  h1: { color: "white", fontSize: 18, fontWeight: "600" },
  status: { color: "#A7A7B3" },
});
