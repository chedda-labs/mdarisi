# Mdarisi

An offline AI tutor for Kenyan CBE learners. It runs entirely on the phone with [QVAC](https://github.com/tetherto/qvac): no internet, no account, no data leaving the device.

Built during [AI Yako: Own Your AI](https://dorahacks.io/hackathon/ai-yako/detail) (24–31 Oct 2026), Offline AI apps track.

## Status

The app covers two sub-strands of Grade 7 Integrated Science: mixtures, and elements and compounds. For each, a learner can:

- **Ask** the tutor: suggested or typed questions, streamed answers grounded in the lesson text, a "Check yourself" question, and a "From the lesson" toggle naming the lesson sections used. Questions the lessons don't cover get "I don't know that yet. Ask your teacher." If the other sub-strand's lesson matches a question clearly better, the answer comes from that lesson and says so.
- Take a 5-question **quiz** marked from answer keys, never by the model. A wrong answer gets the hint first, then the correct answer.
- Tap **Explain** on a wrong answer for the tutor's explanation, built from the item's teacher note.

Measured on the demo phone in airplane mode with Wi-Fi and mobile data also off (27 Oct, commit `0840b52`):

| | Result |
| --- | --- |
| First launch after a fresh install (unpack models, load, read both lessons) | 94 s |
| Later launches to ready | about 9 s; some take 18–20 s |
| On-topic answer, median | 1.7 s to the first word, 7.9 s in full |
| Off-topic question refused | 0.1–0.4 s |
| Peak app memory (total PSS, sampled every 2 s) | about 1.4 GB |
| Test set | 35 / 42 answers with every key fact, 9 / 9 off-topic questions refused ([results](#results)) |

Nearly all of the first launch is reading the two lessons into the KV cache, about 41 s each; later launches reuse it. The slower later launches spend 7–12 s on the first use of the tutor model, most likely because Android no longer has the model file in memory (not proven). Changing the prompt or the model settings makes the next launch read both lessons again.

What the benchmarks settled (26 Oct, one sub-strand):

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

Draft content for two sub-strands (Grade 7 Integrated Science: mixtures, and elements and compounds) is in `content/g7-sci/`. It was drafted with a large language model and is being reviewed by a teacher; every item stays `"status": "draft"` until approved. Strand and sub-strand names are not yet confirmed against the KICD curriculum design.

```bash
npm run pack                                             # drafts included, plus lesson vectors (Node 24, models in bundle/models)
node tools/pack-builder/build.mjs g7-sci                 # approved items only, no vectors
```

The pack builder validates the items and writes `src/packs/g7-sci/pack.json`, which the app imports. `npm run pack` then adds each lesson chunk's EmbeddingGemma vector (`tools/pack-builder/embed.ts`), so the phone doesn't embed the lesson text at every launch; that took about 8 s per sub-strand. The pack records the model's SHA-256, and the app embeds on the device instead if it doesn't match the bundled model.

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

`eval/questions.json` holds 42 in-scope and 9 out-of-scope questions, grouped by the sub-strand the learner has open. The tutor answers from the open sub-strand unless another one's lesson text matches the question clearly better (`ROUTE_MARGIN` in `src/tutor/relevance.ts`); the four routed questions (`r1`–`r4`) must be answered from the other sub-strand. An in-scope answer passes when it isn't refused, every key fact matches one of its patterns, and none of the question's known wrong statements appears. An out-of-scope question passes when the tutor refuses. `src/eval/runEval.ts` asks every question through the app's own `TutorSession` (relevance gate, cached prompt, generation settings); `tools/eval/score.mjs` marks the run and prints Markdown.

- **Phone (reported numbers):** build with `EXPO_PUBLIC_SCREEN=eval` and capture logcat as above. This one uses the models bundled in the APK. Then `npm run eval:score -- logcat.txt`.
- **Laptop (for iterating):** `npm run eval -- <label>` runs the same code on Node 24 with the models in `bundle/models`, then `npm run eval:score -- eval/results/<label>.jsonl`. Answers differ slightly from the phone's, so use it to compare changes, not to report.

#### Results

Demo phone, airplane mode with Wi-Fi and mobile data off, release APK at commit `0840b52`. Raw answers: `eval/results/phone-2026-10-27-tuned.jsonl`.

| Measure | Mixtures | Elements and compounds | All |
| --- | --- | --- | --- |
| In scope: every key fact, no known error | 20 / 26 | 15 / 16 | **35 / 42** |
| In scope: main point right | 23 / 26 | 16 / 16 | **39 / 42** |
| In scope: wrongly refused | 0 | 0 | 0 |
| Routed to the other sub-strand's lesson | 2 / 2 | 2 / 2 | 4 / 4 |
| Out of scope: refused | 6 / 6 | 3 / 3 | **9 / 9** |
| Relevance, in scope | 0.424–0.860 | 0.413–0.744 | 0.413–0.860 |
| Relevance, out of scope | 0.161–0.330 | 0.138–0.304 | 0.138–0.330 |
| Median first word (answered) | 1.7 s | 1.8 s | 1.7 s |
| Median full answer (answered) | 8.0 s | 7.4 s | 7.9 s |

Answers took 3.1–14.4 s in full, with the first word after 0.4–2.8 s. Every off-topic question was stopped by the relevance gate, so the tutor model was never asked.

The seven that fail:

- **Errors (2):** "Is githeri a uniform mixture?" opens with "Yes." and then correctly says it is non-uniform. "Is salt water a mixture? Why?" names filtering as a way to separate it.
- **Missing a key fact (5):** muddy water clears because it is non-uniform (q9); a mixture can be separated because its substances are not chemically joined (q18); each substance keeps its own properties (q23); "What is an element?" gives no example element (e1, and r2, the same question asked from the Mixtures tab).

Before tuning, the same phone scored 32 / 42 and 38 / 42 (`eval/results/phone-2026-10-27-vectors.jsonl`). Tuning reworded lesson text the model misread (sieving, githeri, the water molecule, non-metals) and added a "Yes." example to the prompt. Each variant was compared over four sampling seeds on the laptop, because any prompt change moves unrelated answers by about ±3 questions; those runs are in `eval/results/laptop-2026-10-27-tune-*.jsonl`. The scoring patterns were not changed during tuning.

## How the model gets onto the phone

The QVAC registry download timed out on our network, so the model ships inside the release APK:

- `plugins/withBundledModel.js` adds `bundle/` as an uncompressed asset folder for release builds.
- `modules/model-store` (local Expo module, Kotlin) copies it into the app's private storage on first launch, after checking free space, and returns the path.

This is a demo shortcut. The product design keeps models and content as separate packs, so app updates don't re-download the models.

## Credits

- [QVAC SDK](https://github.com/tetherto/qvac) by Tether
- [Expo](https://expo.dev) and React Native
- Qwen3 by Alibaba Cloud, EmbeddingGemma by Google, Llama 3.2 by Meta; GGUF conversions by Unsloth
