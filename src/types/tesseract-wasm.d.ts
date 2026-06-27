declare module "tesseract-wasm" {
  export type IntRect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };

  export type TextItem = {
    rect: IntRect;
    flags: number;
    confidence: number;
    text: string;
  };

  export class OCRClient {
    constructor(options?: {
      workerURL?: string;
      wasmBinary?: Uint8Array | ArrayBuffer;
    });

    clearImage(): Promise<void>;
    loadModel(model: string | ArrayBuffer): Promise<void>;
    loadImage(image: ImageBitmap | ImageData): Promise<void>;
    getTextBoxes(unit: "line" | "word"): Promise<TextItem[]>;
  }

  export function supportsFastBuild(): boolean;
}
