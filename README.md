<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/mdarisi-logo-horizontal-white.png">
  <img src="docs/brand/mdarisi-logo-horizontal.png" alt="Mdarisi" width="320">
</picture>

**Mdarisi is an AI tutor that works without internet.** It helps Kenyan learners study the Competency-Based Education (CBE) curriculum on an Android phone. Everything runs on the phone itself: there is no account to make, and nothing the learner types leaves the phone.

Built for the [AI Yako: Own Your AI hackathon](https://dorahacks.io/hackathon/ai-yako/detail) (24–31 October 2026). It uses [QVAC](https://github.com/tetherto/qvac), Tether's toolkit for running AI on your own device.

- **Demo video:** [youtu.be/DdSt7OM_IYc](https://youtu.be/DdSt7OM_IYc) (the phone is in airplane mode throughout)
- **Download the app:** [v1.0.0 release](https://github.com/chedda-labs/mdarisi/releases/tag/v1.0.0) (Android APK)

## What a learner can do

The app covers two topics from Grade 7 Integrated Science: **mixtures**, and **elements and compounds**. For each topic, a learner can:

- **Ask Mwalimu (the tutor) a question.** Mwalimu answers only from the lesson, and can show which part of the lesson it used. If the lesson doesn't cover the question, Mwalimu says "I don't know that yet. Ask your teacher." instead of guessing. If the question belongs to the other topic, Mwalimu answers from that lesson and says so.
- **Take a 5-question quiz.** The app marks answers using the answer key, not the AI, so the marks are always right. A wrong answer gets a hint first, then the correct answer.
- **Tap "Ask Mwalimu why"** after a wrong answer to have Mwalimu explain it, using the teacher's note for that question.

## How it works

1. **The lesson is read once.** The first time the app opens, the AI reads the whole lesson and saves its work on the phone. After that, it only has to read the learner's question, so answers start in about 2 seconds.
2. **Each question is checked first.** A small second model compares the question with the lesson. If they don't match, the app refuses straight away, without asking the tutor. The tutor model is too small to be trusted to refuse by itself.
3. **The tutor answers from the lesson.** It writes the answer word by word on the screen.

## How well it works

We tested it on a mid-range phone (Redmi Note 13, 6 GB of memory) in airplane mode, with Wi-Fi and mobile data off.

| What we measured | Result |
| --- | --- |
| Questions answered with every key fact | 34 of 42 |
| Questions where the main point was right | 38 of 42 |
| Off-topic questions refused | 9 of 9 |
| Time until the answer starts | about 2 seconds |
| Time for the full answer | about 8 seconds |
| Opening the app | about 9 seconds (94 seconds the very first time) |

The full results, including the eight answers that fall short, are in [docs/development.md](docs/development.md#results).

We also ran it on a low-cost phone (Samsung Galaxy A03, 2.5 GB of memory). It handled every question we asked, refusing the one outside the lessons, and ran a full quiz without a crash. It was slower: the first launch took about 85 seconds, and answers were slower to appear. The app used about 1.2 GB of memory, so Android had to move part of it to storage. For the best experience, use a phone with 4 GB of memory or more. Details are in [docs/development.md](docs/development.md#low-memory-phone).

## What needs internet

Nothing. The AI models are inside the app, so it works offline from the first launch.

## Try it

You need an Android phone with a 64-bit (arm64) processor, Android 10 or newer, at least 2.5 GB of memory (4 GB or more recommended), and about 1.8 GB of free space.

1. Install the app (APK file) from the [v1.0.0 release](https://github.com/chedda-labs/mdarisi/releases/tag/v1.0.0). It is about 890 MB because the AI models are inside it.
2. Turn on airplane mode and turn off Wi-Fi.
3. Open Mdarisi. The first launch takes about a minute and a half while it reads the lessons; later launches take about 9 seconds.

## Build it yourself

You need:

- [Node.js](https://nodejs.org) 24 (the exact version is in `.nvmrc`)
- Java (JDK) 17 and the [Android SDK](https://developer.android.com/studio), with NDK versions 29.0.14206865 and 27.0.12077973
- An Android phone as described above, connected by USB with USB debugging turned on. The app does not run in an emulator.

Then run these commands:

```bash
# 1. Get the code
git clone https://github.com/chedda-labs/mdarisi.git
cd mdarisi

# 2. Install the tools the app needs
nvm use
npm install

# 3. Create the Android project
npx expo prebuild --platform android

# 4. Download the AI models (about 1.4 GB)
./tools/fetch-model.sh

# 5. Build the app
cd android
./gradlew assembleRelease --max-workers=2

# 6. Install it on the phone
adb install -r app/build/outputs/apk/release/app-release.apk
```

If you run `npm install` again later, run step 3 again too.

## The AI models

| Job | Model | Size | Licence |
| --- | --- | --- | --- |
| Tutor | Qwen3 0.6B (Q4_0) | 382 MB | Apache-2.0 |
| Checking if a question matches the lesson | EmbeddingGemma 300M (Q4_0) | 278 MB | Gemma Terms of Use |

Both run on the phone's processor (CPU) through `@qvac/sdk` 0.22.0. We also tried Llama 3.2 1B, but it refused questions the lesson did answer, so we chose Qwen3.

## Limits

- The lesson content is a **draft**. It was written with the help of an AI model and is being checked by a teacher. Topic names are not yet checked against the official KICD curriculum.
- The app is in English only, and has been tested on Android only.

## For developers

[docs/development.md](docs/development.md) covers the lesson content format, where QVAC is used in the code, benchmarks and the test set.

## Credits

- [QVAC SDK](https://github.com/tetherto/qvac) by Tether
- [Expo](https://expo.dev) and React Native
- Qwen3 by Alibaba Cloud, EmbeddingGemma by Google, Llama 3.2 by Meta; GGUF conversions by Unsloth
- Fonts: [Baloo 2](https://github.com/EkType/Baloo2), [Nunito](https://github.com/googlefonts/nunito) and [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans), SIL Open Font License 1.1 (licences in `assets/fonts/`)
- [react-native-svg](https://github.com/software-mansion/react-native-svg) for icons

## Licence

Copyright (c) 2026 Isaack Njama. The code and lesson content are released under the MIT License; see [LICENSE](LICENSE). The AI models, fonts and libraries keep their own licences (see [The AI models](#the-ai-models) and the credits above).
