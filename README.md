# Mdarisi

An offline AI tutor for Kenyan CBE learners. It runs entirely on the phone with [QVAC](https://github.com/tetherto/qvac): no internet, no account, no data leaving the device.

Built during [AI Yako: Own Your AI](https://dorahacks.io/hackathon/ai-yako/detail) (24–31 Oct 2026), Offline AI apps track.

## Status

Day 1: an on-device smoke test. The app copies the tutor model out of the APK on first launch, loads it with QVAC and streams one completion, timing each step. The tutor, quiz and content pack come next.

Measured on the demo phone in airplane mode, fresh install:

| Step | Time |
| --- | --- |
| Copy model out of APK (first launch only) | 1.7 s |
| Model load | 5.3 s |
| Time to first token | 7.0 s |
| Generation | 8.6 tokens/s |

## Device and requirements

- **Demo phone:** Redmi Note 13 (Snapdragon 685, 6 GB RAM), Android 15, arm64-v8a. Inference runs on CPU.
- **Android:** arm64, minSdk 29. About 1.8 GB free storage for the first launch (APK plus copied model).
- **Network-dependent features:** none.

## AI

| | |
| --- | --- |
| Runtime | `@qvac/sdk` 0.22.0 (llama.cpp completion plugin only, see `qvac.config.json`) |
| Model | Llama 3.2 1B Instruct, Q4_0 GGUF (773 MB), QVAC catalog entry `LLAMA_3_2_1B_INST_Q4_0` |
| Model source | [unsloth/Llama-3.2-1B-Instruct-GGUF](https://huggingface.co/unsloth/Llama-3.2-1B-Instruct-GGUF), pinned revision and SHA-256 in `src/tutor/model.json` |
| Model licence | Llama 3.2 Community License |

Files using QVAC: `App.tsx` (load and completion), `src/tutor/model.ts` (model path), `qvac.config.json`, `app.json` (Expo plugin).

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
```

Run `npx expo prebuild` again after any `npm install`: reinstalling packages clears QVAC's linked native addons.

### Release build (model inside the APK)

```bash
./tools/fetch-model.sh                 # downloads into bundle/models/ and checks the SHA-256
cd android && ./gradlew assembleRelease
adb install app/build/outputs/apk/release/app-release.apk
```

The APK is about 1 GB. The build fails if the model is missing or the wrong size.

### Debug build

Debug builds don't bundle the model, to keep installs fast. Push it once instead:

```bash
./tools/fetch-model.sh
D=/storage/emulated/0/Android/data/com.mdarisi.app/files/models
adb shell mkdir -p $D
adb push bundle/models/Llama-3.2-1B-Instruct-Q4_0.gguf $D/
adb shell chmod 755 /storage/emulated/0/Android/data/com.mdarisi.app /storage/emulated/0/Android/data/com.mdarisi.app/files $D
adb shell chmod 644 $D/Llama-3.2-1B-Instruct-Q4_0.gguf
npx expo run:android --device <model name, e.g. 23129RAA4G>
```

The `chmod` steps are needed because folders created by adb aren't readable by the app.

## How the model gets onto the phone

The QVAC registry download timed out on our network, so the model ships inside the release APK:

- `plugins/withBundledModel.js` adds `bundle/` as an uncompressed asset folder for release builds.
- `modules/model-store` (local Expo module, Kotlin) copies it into the app's private storage on first launch, after checking free space, and returns the path.

This is a demo shortcut. The product design keeps models and content as separate packs, so app updates don't re-download a 773 MB model.

## Credits

- [QVAC SDK](https://github.com/tetherto/qvac) by Tether
- [Expo](https://expo.dev) and React Native
- Llama 3.2 by Meta, GGUF conversion by Unsloth
