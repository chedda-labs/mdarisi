// Packs bundle/models/ (see tools/fetch-model.sh) into release APKs as uncompressed
// assets, so the app can copy the model to its private storage on first launch
// with no network. Debug builds skip it to keep install times short.
const { withAppBuildGradle } = require("expo/config-plugins");
const model = require("../src/tutor/model.json");

const MARKER = "// mdarisi: bundled model";

const gradle = `
${MARKER}
android {
    sourceSets {
        release {
            assets.srcDirs += [new File(rootDir, "../bundle")]
        }
    }
    androidResources {
        noCompress += ["gguf"]
    }
}

tasks.matching { it.name == "mergeReleaseAssets" }.configureEach {
    doFirst {
        def model = new File(rootDir, "../bundle/models/${model.file}")
        if (!model.exists() || model.length() != ${model.size}L) {
            throw new GradleException("Bundled model missing or incomplete: run tools/fetch-model.sh")
        }
    }
}
`;

module.exports = function withBundledModel(config) {
  return withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes(MARKER)) {
      config.modResults.contents += gradle;
    }
    return config;
  });
};
