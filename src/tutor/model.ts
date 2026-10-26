import ModelStore from "../../modules/model-store";
import model from "./model.json";

// Debug builds don't bundle the model; push it here over adb instead (see README).
const DEV_MODEL_PATH = `/storage/emulated/0/Android/data/com.mdarisi.app/files/models/${model.file}`;

// Returns a local path to the tutor model, copying it out of the APK on first launch.
export async function resolveModelPath(onCopyProgress: (percentage: number) => void): Promise<string> {
  const sub = ModelStore.addListener("onCopyProgress", (e) => onCopyProgress(e.percentage));
  try {
    return (await ModelStore.ensureBundledModel(model.file)) ?? DEV_MODEL_PATH;
  } finally {
    sub.remove();
  }
}
