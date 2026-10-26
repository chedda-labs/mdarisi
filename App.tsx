import React, { useEffect, useState } from "react";
import { Platform, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";

import {
  completion,
  loadModel,
  type ModelProgressUpdate,
  unloadModel,
  VERBOSITY,
} from "@qvac/sdk";

import { resolveModelPath } from "./src/tutor/model";

// Day-1 smoke test: download, load and stream one completion on the device,
// timing each step so the model gate in the plan can be checked.
export default function App() {
  const [status, setStatus] = useState("Starting…");
  const [output, setOutput] = useState("");
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [timings, setTimings] = useState<string[]>([]);

  useEffect(() => {
    let modelId: string | null = null;
    let cancelled = false;
    const log = (line: string) => {
      console.log(`[smoke] ${line}`);
      if (!cancelled) setTimings((t) => [...t, line]);
    };

    (async () => {
      try {
        setStatus("Preparing model…");
        let t0 = Date.now();
        const modelPath = await resolveModelPath((pct) => {
          if (!cancelled) setProgressPct(pct);
        });
        log(`prepare: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
        setProgressPct(null);
        if (cancelled) return;

        // CPU: the Adreno 610 on the demo phone is below QVAC's GPU support line.
        setStatus("Loading model…");
        t0 = Date.now();
        modelId = await loadModel({
          modelSrc: modelPath,
          modelType: "llamacpp-completion",
          modelConfig: {
            device: "cpu",
            ctx_size: 2048,
            verbosity: VERBOSITY.ERROR,
          },
          onProgress: (progress: ModelProgressUpdate) => {
            if (!cancelled) setProgressPct(Math.round(progress.percentage));
          },
        });
        log(`load: ${((Date.now() - t0) / 1000).toFixed(1)} s`);

        if (cancelled) {
          await unloadModel({ modelId, clearStorage: false });
          return;
        }
        setProgressPct(null);

        setStatus("Running completion…");
        t0 = Date.now();
        const result = completion({
          modelId,
          history: [
            {
              role: "user",
              content: "In two sentences, explain to a Grade 7 learner what a mixture is.",
            },
          ],
          stream: true,
        });

        let acc = "";
        let tokens = 0;
        let firstTokenAt: number | null = null;
        for await (const token of result.tokenStream) {
          if (firstTokenAt == null) firstTokenAt = Date.now();
          tokens++;
          acc += token;
          if (!cancelled) setOutput(acc);
        }
        const end = Date.now();
        log(`first token: ${(((firstTokenAt ?? end) - t0) / 1000).toFixed(1)} s`);
        log(`total: ${((end - t0) / 1000).toFixed(1)} s, ${tokens} tokens`);
        if (firstTokenAt != null && end > firstTokenAt) {
          log(`decode: ${(tokens / ((end - firstTokenAt) / 1000)).toFixed(1)} tok/s`);
        }

        if (!cancelled) setStatus("Done ✅");
      } catch (e: any) {
        console.error("[smoke]", e);
        if (!cancelled) setStatus(`Error: ${e?.message ?? String(e)}`);
      }
    })();

    return () => {
      cancelled = true;
      if (modelId) {
        void unloadModel({ modelId, clearStorage: false }).catch(() => {});
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.h1}>Mdarisi smoke test</Text>
        <Text style={styles.status}>
          {status}
          {progressPct != null ? ` (${progressPct}%)` : ""}
        </Text>
        {progressPct != null && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        )}
        <Text style={styles.output}>{output}</Text>
        {timings.map((t) => (
          <Text key={t} style={styles.status}>
            {t}
          </Text>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0B0F", paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 },
  container: { flex: 1, padding: 16, gap: 12 },
  h1: { color: "white", fontSize: 18, fontWeight: "600" },
  status: { color: "#A7A7B3" },
  progressBar: { height: 8, backgroundColor: "#1A1A22", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#22C55E", borderRadius: 4 },
  output: { color: "white", fontSize: 16, lineHeight: 22 },
});
