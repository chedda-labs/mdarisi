# Mdarisi

An offline AI tutor for Kenyan CBE learners. It runs entirely on the phone with [QVAC](https://github.com/tetherto/qvac): no internet, no account, no data leaving the device.

Built during [AI Yako: Own Your AI](https://dorahacks.io/hackathon/ai-yako/detail) (24–31 Oct 2026), Offline AI apps track.

## Status

The app currently opens a benchmark screen (`src/bench/`). The learner-facing tutor screen comes next. What the benchmarks settled, measured on the demo phone:

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

Sources, pinned revisions and SHA-256s are in `src/tutor/models.json`. The release APK still bundles Llama from day 1; switching the bundle to Qwen3 and EmbeddingGemma comes with the tutor screen.

Files using QVAC: `src/tutor/` (model paths, prompt, relevance gate), `src/bench/` (benchmarks), `App.tsx`, `qvac.config.json`, `app.json` (Expo plugin).

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

The APK is about 1 GB. The build fails if a bundled model is missing or the wrong size. `--max-workers=2` keeps Gradle within memory on a 16 GB laptop; without it the kernel's out-of-memory killer stopped the build.

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

`App.tsx` runs one benchmark and writes JSON lines to logcat:

- `src/bench/runBench.ts`: model bake-off (models × thread counts, then quality questions). Summarise with `node tools/eval/bench-report.mjs <logcat.txt> [<meminfo.tsv>]`.
- `src/bench/runCacheTest.ts`: cached sub-strand prompt plus relevance gate, in-scope and out-of-scope questions.

```bash
adb logcat -c && adb logcat -v epoch ReactNativeJS:V '*:S' > logcat.txt &
tools/eval/sample-mem.sh > meminfo.tsv &       # app memory every 2 s
adb shell monkey -p com.mdarisi.app -c android.intent.category.LAUNCHER 1
```

## How the model gets onto the phone

The QVAC registry download timed out on our network, so the model ships inside the release APK:

- `plugins/withBundledModel.js` adds `bundle/` as an uncompressed asset folder for release builds.
- `modules/model-store` (local Expo module, Kotlin) copies it into the app's private storage on first launch, after checking free space, and returns the path.

This is a demo shortcut. The product design keeps models and content as separate packs, so app updates don't re-download the models.

## Credits

- [QVAC SDK](https://github.com/tetherto/qvac) by Tether
- [Expo](https://expo.dev) and React Native
- Qwen3 by Alibaba Cloud, EmbeddingGemma by Google, Llama 3.2 by Meta; GGUF conversions by Unsloth
