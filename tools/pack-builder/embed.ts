// Adds lesson-chunk vectors to a built pack, so the phone doesn't re-embed
// the lesson text at every launch. Uses the app's own buildIndex and the
// model file the APK bundles; the app ignores the vectors if the model differs.
//
//   npm run pack
//
// (build.mjs first, then this, on Node 24 with the models in bundle/models.)
import fs from "node:fs";
import path from "node:path";

import { close, loadModel, unloadModel } from "@qvac/sdk";

import { subStrandContext } from "../../src/tutor/context";
import models from "../../src/tutor/models.json";
import { buildIndex, EMBED_CONFIG } from "../../src/tutor/relevance";

const packFile = path.join("src/packs", process.argv[2] ?? "g7-sci", "pack.json");

async function main() {
  const pack = JSON.parse(fs.readFileSync(packFile, "utf8"));
  const embedId = await loadModel({
    modelSrc: path.resolve("bundle/models", models.embed.file),
    modelType: "llamacpp-embedding",
    modelConfig: EMBED_CONFIG,
  });

  const vectors = new Map<string, number[]>();
  for (const { id } of pack.subStrands) {
    const index = await buildIndex(embedId, subStrandContext(pack, id));
    // Six significant digits move cosine scores by well under 0.0001.
    index.chunks.forEach((c, i) => vectors.set(c.id, index.vectors[i].map((x) => Number(x.toPrecision(6)))));
  }
  for (const chunk of pack.chunks) {
    const v = vectors.get(chunk.id);
    if (v) chunk.vector = v;
  }
  pack.manifest.embedModel = models.embed.sha256;

  // One line per vector instead of one per number.
  const json = JSON.stringify(pack, null, 2).replace(/\[\s+(-?[\d.e+-]+(?:,\s+-?[\d.e+-]+)*)\s+\]/g, (_, nums) => `[${nums.replace(/\s+/g, "")}]`);
  fs.writeFileSync(packFile, json + "\n");
  console.log(`embed: ${vectors.size} chunk vectors -> ${packFile}`);

  await unloadModel({ modelId: embedId, clearStorage: false });
  await close();
}

main();
