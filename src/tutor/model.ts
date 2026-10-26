import ModelStore from "../../modules/model-store";
import models from "./models.json";

export type ModelRole = keyof typeof models;

// Debug builds and benchmarks load models pushed here over adb (see README).
const DEV_MODEL_DIR = "/storage/emulated/0/Android/data/com.mdarisi.app/files/models";

export function devModelPath(role: ModelRole): string {
  return `${DEV_MODEL_DIR}/${models[role].file}`;
}

// Returns a local path to a model, copying it out of the APK on first launch
// when the release build bundles it.
export async function resolveModelPath(
  role: ModelRole,
  onCopyProgress: (percentage: number) => void,
): Promise<string> {
  const model = models[role];
  if (!model.bundle) return devModelPath(role);
  const sub = ModelStore.addListener("onCopyProgress", (e) => onCopyProgress(e.percentage));
  try {
    return (await ModelStore.ensureBundledModel(model.file)) ?? devModelPath(role);
  } finally {
    sub.remove();
  }
}
