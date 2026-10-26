import React, { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { runBench } from "../bench/runBench";
import { runCacheTest } from "../bench/runCacheTest";

// Benchmarks write JSON lines to logcat; see README "Benchmarks".
export default function BenchScreen({ which }: { which: "bench" | "cache" }) {
  const [status, setStatus] = useState("Starting…");

  useEffect(() => {
    const run = which === "bench" ? runBench : runCacheTest;
    run(setStatus).catch((e: any) => {
      console.error("[bench]", e);
      setStatus(`Error: ${e?.message ?? String(e)}`);
    });
  }, [which]);

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.h1}>Mdarisi {which === "bench" ? "model bake-off" : "cache test"}</Text>
      <Text style={styles.status}>{status}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0B0F", padding: 16, gap: 12 },
  h1: { color: "white", fontSize: 18, fontWeight: "600" },
  status: { color: "#A7A7B3" },
});
