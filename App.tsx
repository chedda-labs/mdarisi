import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import BenchScreen from "./src/screens/BenchScreen";
import TutorScreen from "./src/screens/TutorScreen";

// Set at bundle time: EXPO_PUBLIC_SCREEN=bench, =cache or =eval runs a benchmark or the test set instead of the tutor.
const SCREEN = process.env.EXPO_PUBLIC_SCREEN;

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {SCREEN === "bench" || SCREEN === "cache" || SCREEN === "eval" ? <BenchScreen which={SCREEN} /> : <TutorScreen />}
    </SafeAreaProvider>
  );
}
