// Packs bundle/models/ (see tools/fetch-model.sh) into release APKs as uncompressed
// assets, so the app can copy the model to its private storage on first launch
// with no network. Debug builds skip it to keep install times short.
const { withAppBuildGradle } = require("expo/config-plugins");
const models = require("../src/tutor/models.json");

const BEGIN = "// mdarisi: bundled models (begin)";
const END = "// mdarisi: bundled models (end)";
const checks = Object.values(models)
  .filter((m) => m.bundle)
  .map((m) => `["${m.file}", ${m.size}L]`)
  .join(", ");

const gradle = `
${BEGIN}
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
        [${checks}].each { name, size ->
            def model = new File(rootDir, "../bundle/models/" + name)
            if (!model.exists() || model.length() != size) {
                throw new GradleException("Bundled model " + name + " missing or incomplete: run tools/fetch-model.sh")
            }
        }
    }
}
${END}
`;

// Replaces the block on every prebuild, so a changed model list reaches an
// existing android/ folder too.
module.exports = function withBundledModel(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    const start = contents.indexOf(`\n${BEGIN}`);
    const end = contents.indexOf(END);
    const rest = start >= 0 && end > start ? contents.slice(0, start) + contents.slice(end + END.length + 1) : contents;
    config.modResults.contents = rest + gradle;
    return config;
  });
};
