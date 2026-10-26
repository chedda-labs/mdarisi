import { NativeModule, requireNativeModule } from "expo";

type ModelStoreEvents = {
  onCopyProgress: (event: { percentage: number }) => void;
};

declare class ModelStoreModule extends NativeModule<ModelStoreEvents> {
  ensureBundledModel(file: string): Promise<string | null>;
}

export default requireNativeModule<ModelStoreModule>("ModelStore");
