import React, { useEffect, useState } from "react";
import { Platform, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";

import { runCacheTest } from "./src/bench/runCacheTest";

// Day-2 KV-cache test: results go to logcat as [cache] JSON lines.
// (The model bake-off is src/bench/runBench.ts.)
export default function App() {
  const [status, setStatus] = useState("Starting…");

  useEffect(() => {
    runCacheTest(setStatus).catch((e: any) => {
      console.error("[bench]", e);
      setStatus(`Error: ${e?.message ?? String(e)}`);
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.h1}>Mdarisi cache test</Text>
        <Text style={styles.status}>{status}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0B0F", paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 },
  container: { flex: 1, padding: 16, gap: 12 },
  h1: { color: "white", fontSize: 18, fontWeight: "600" },
  status: { color: "#A7A7B3" },
});
