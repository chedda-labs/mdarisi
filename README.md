# Mdarisi

An offline AI tutor for Kenyan CBE learners. It runs entirely on the phone with [QVAC](https://github.com/tetherto/qvac): no internet, no account, no data leaving the device.

Built during [AI Yako: Own Your AI](https://dorahacks.io/hackathon/ai-yako/detail) (24–31 Oct 2026), Offline AI apps track.

## Status

The app opens the tutor for one sub-strand (mixtures): suggested questions, typed questions, streamed answers grounded in the lesson text, a "Check yourself" question, and a "From the lesson" toggle naming the lesson sections used. Off-topic questions get "I don't know that yet. Ask your teacher." The quiz and "Explain" come next.

Measured on the demo phone in airplane mode, fresh install:

| | Result |
| --- | --- |
| First launch to ready (unpack models, load, read the lesson) | 68 s |
| Later launches to ready | 32 s |
| On-topic answer | 7–10 s |
| Off-topic question refused | 3.6 s |
| Peak app memory | about 1.9 GB |

What the benchmarks settled:

- **Tutor model: Qwen3 0.6B.** Llama 3.2 1B refused questions its lesson text answered and scored 1–2 of 5.
- **Whole sub-strand in a cached prompt.** The lesson text for one sub-strand sits in a fixed system prompt cached with QVAC's `kvCache`. The phone reads it once (about 37 s, stored on disk and reused after restarts), then each question costs only its own ~15–20 tokens.
- **Relevance gate before the model.** EmbeddingGemma scores each question against the sub-strand's text; below the threshold the tutor replies "I don't know that yet. Ask your teacher." without calling the LLM. The 0.6B model can't be trusted to refuse on its own.

| Measure (Qwen3 0.6B, CPU, 6 threads) | Result |
| --- | --- |
| Time to first word | 1.1–2.0 s |
| Full answer (≤ 72 tokens) | 3.5–14 s |
| Original 5 test questions | 4 / 5 correct |
| Relevance gate on 15 questions | 15 / 15 (in-scope 0.445–0.860, out-of-scope 0.172–0.331, threshold 0.39) |
| Peak app memory, both models loaded | about 1.95 GB |

Without the cache, a ~550-token grounded prompt took 15–32 s before the first word: the phone reads prompts at only 18–36 tokens/s.

## Device and requirements

- **Demo phone:** Redmi Note 13 (Snapdragon 685, 6 GB RAM), Android 15, arm64-v8a. Everything runs on CPU; the Adreno 610 is below QVAC's supported GPUs.
- **Android:** arm64, minSdk 29. About 1.8 GB free storage for the first launch (APK plus copied model).
- **Network-dependent features:** none.

## AI

| | |
| --- | --- |
| Runtime | `@qvac/sdk` 0.22.0, llama.cpp completion and embedding plugins (`qvac.config.json`) |
| Tutor model | Qwen3 0.6B, Q4_0 GGUF (382 MB), catalog `QWEN3_600M_INST_Q4`, Apache-2.0 |
| Relevance model | EmbeddingGemma 300M, Q4_0 GGUF (278 MB), catalog `EMBEDDINGGEMMA_300M_Q4_0`, Gemma Terms of Use |
| Baseline (rejected) | Llama 3.2 1B Instruct, Q4_0 GGUF (773 MB), catalog `LLAMA_3_2_1B_INST_Q4_0`, Llama 3.2 Community License |

Sources, pinned revisions and SHA-256s are in `src/tutor/models.json`. The release APK bundles Qwen3 0.6B and EmbeddingGemma; Llama is only used by the benchmarks.

Files using QVAC: `src/tutor/session.ts` (load, prime the cached prompt, gate, stream answers, suspend and resume), `src/tutor/relevance.ts` (embedding gate), `src/tutor/prompt.ts`, `src/bench/` (benchmarks), `qvac.config.json`, `app.json` (Expo plugin).

## Content

Draft content for one sub-strand (Grade 7 Integrated Science, mixtures) is in `content/g7-sci/`. It was drafted with a large language model and is being reviewed by a teacher; every item stays `"status": "draft"` until approved. Strand and sub-strand names are not yet confirmed against the KICD curriculum design.

```bash
node tools/pack-builder/build.mjs g7-sci                 # approved items only
node tools/pack-builder/build.mjs g7-sci --allow-drafts  # include drafts (benchmarks only)
```

The pack builder validates the items and writes `src/packs/g7-sci/pack.json`, which the app imports.

## Setup

Prerequisites:

- Node 24.22.1 (`nvm use`; QVAC 0.22 bundling needs `^22.21.0 || >=24.9.0`)
- JDK 17 and the Android SDK
- NDK **29.0.14206865** (QVAC) and **27.0.12077973** (`react-native-bare-kit` falls back to Gradle's default). Gradle installs both on demand, but its download can be very slow; installing them yourself is faster.
- An arm64 Android phone with USB debugging on (QVAC needs a physical device)

```bash
nvm use
npm install
npx expo prebuild --platform android   # also generates and links the QVAC worker bundle in qvac/
./tools/fetch-model.sh                 # downloads every model in src/tutor/models.json and checks SHA-256s
```

Run `npx expo prebuild` again after any `npm install` or change to `qvac.config.json`: reinstalling packages clears QVAC's linked native addons.

`fetch-model.sh` puts models marked `"bundle": true` in `bundle/models/` (packed into release APKs) and the rest in `.models/`.

### Release build

```bash
cd android && ./gradlew assembleRelease --max-workers=2
adb install -r app/build/outputs/apk/release/app-release.apk
```

The APK is about 890 MB. The build fails if a bundled model is missing or the wrong size. `--max-workers=2` keeps Gradle within memory on a 16 GB laptop; without it the kernel's out-of-memory killer stopped the build.

On Xiaomi phones, installing over USB needs a confirmation that fails in airplane mode (`INSTALL_FAILED_USER_RESTRICTED`). Install with the network on, then switch airplane mode on before opening the app.

After changing `src/tutor/models.json`, run `npx expo prebuild --platform android` again so the release build packs the new list.

### Models for debug builds and benchmarks

Models not in the APK are loaded from the app's external files folder. Push them once:

```bash
B=/storage/emulated/0/Android/data/com.mdarisi.app
adb shell mkdir -p $B/files/models
adb push bundle/models/*.gguf .models/*.gguf $B/files/models/
adb shell chmod 755 $B $B/files $B/files/models
adb shell chmod 644 "$B/files/models/*.gguf"
```

The `chmod` steps are needed because folders created by adb aren't readable by the app. `adb uninstall` deletes this folder; use `adb install -r` to keep it.

### Benchmarks

Build with `EXPO_PUBLIC_SCREEN` set to open a benchmark instead of the tutor. Benchmarks write JSON lines to logcat and load models from the debug folder above, so push the models first.

- `EXPO_PUBLIC_SCREEN=bench`: model bake-off (`src/bench/runBench.ts`: models × thread counts, then quality questions). Summarise with `node tools/eval/bench-report.mjs <logcat.txt> [<meminfo.tsv>]`.
- `EXPO_PUBLIC_SCREEN=cache`: cached sub-strand prompt plus relevance gate, in-scope and out-of-scope questions (`src/bench/runCacheTest.ts`).

```bash
cd android && EXPO_PUBLIC_SCREEN=cache ./gradlew assembleRelease --max-workers=2 && cd ..
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb logcat -c && adb logcat -v epoch ReactNativeJS:V '*:S' > logcat.txt &
tools/eval/sample-mem.sh > meminfo.tsv &       # app memory every 2 s
adb shell monkey -p com.mdarisi.app -c android.intent.category.LAUNCHER 1
```

### Test set

`eval/questions.json` holds 24 in-scope questions on the mixtures sub-strand and 8 out-of-scope ones. An in-scope answer passes when it isn't refused, every key fact matches one of its patterns, and none of the question's known wrong statements appears. An out-of-scope question passes when the tutor refuses. `src/eval/runEval.ts` asks every question through the app's own `TutorSession` (relevance gate, cached prompt, generation settings); `tools/eval/score.mjs` marks the run and prints Markdown.

- **Phone (reported numbers):** build with `EXPO_PUBLIC_SCREEN=eval` and capture logcat as above. This one uses the models bundled in the APK. Then `npm run eval:score -- logcat.txt`.
- **Laptop (for iterating):** `npm run eval -- <label>` runs the same code on Node 24 with the models in `bundle/models`, then `npm run eval:score -- eval/results/<label>.jsonl`. Answers differ slightly from the phone's, so use it to compare changes, not to report.
## How the model gets onto the phone

The QVAC registry download timed out on our network, so the model ships inside the release APK:

- `plugins/withBundledModel.js` adds `bundle/` as an uncompressed asset folder for release builds.
- `modules/model-store` (local Expo module, Kotlin) copies it into the app's private storage on first launch, after checking free space, and returns the path.

This is a demo shortcut. The product design keeps models and content as separate packs, so app updates don't re-download the models.

## Credits

- [QVAC SDK](https://github.com/tetherto/qvac) by Tether
- [Expo](https://expo.dev) and React Native
- Qwen3 by Alibaba Cloud, EmbeddingGemma by Google, Llama 3.2 by Meta; GGUF conversions by Unsloth
