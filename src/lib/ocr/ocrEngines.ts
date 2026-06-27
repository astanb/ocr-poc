import type { Point2D } from "@paddleocr/paddleocr-js";
import { OCRClient, supportsFastBuild } from "tesseract-wasm";
import tesseractWasmFastUrl from "../../../node_modules/tesseract-wasm/dist/tesseract-core.wasm?url";
import tesseractWasmFallbackUrl from "../../../node_modules/tesseract-wasm/dist/tesseract-core-fallback.wasm?url";
import tesseractWasmWorkerUrl from "../../../node_modules/tesseract-wasm/dist/tesseract-worker.js?url";
import type { ExtractedTextItem } from "../../types/floorPlan";
import { extractImageText } from "./extractImageText";
import type { OcrEngine } from "./ocrPipeline";

type OcrImage = File | Blob | HTMLCanvasElement | string;

export type OcrEngineId = "tesseract" | "paddle" | "tesseract-wasm";
export type OcrStrategyId =
  | "tesseract"
  | "paddle"
  | "tesseract-wasm"
  | "compare-all";

const TESSERACT_WASM_MODEL_URL =
  "https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_fast@main/eng.traineddata";
const PADDLE_MODEL_BASE_URL = `${import.meta.env.BASE_URL}vendor/paddleocr`;

export const OCR_STRATEGIES: Array<{
  id: OcrStrategyId;
  label: string;
  description: string;
}> = [
  {
    id: "compare-all",
    label: "Compare all OCR engines",
    description: "Run Tesseract.js, PaddleOCR.js, and tesseract-wasm, keeping the best room matches."
  },
  {
    id: "tesseract",
    label: "Tesseract only",
    description: "Use the existing Tesseract.js OCR path."
  },
  {
    id: "paddle",
    label: "Paddle only",
    description: "Use PaddleOCR.js with PP-OCRv5 browser models."
  },
  {
    id: "tesseract-wasm",
    label: "tesseract-wasm only",
    description: "Use the smaller WebAssembly Tesseract build."
  }
];

export function getOcrEngines(strategyId: OcrStrategyId): OcrEngine<OcrImage>[] {
  if (strategyId === "paddle") {
    return [paddleEngine];
  }

  if (strategyId === "tesseract") {
    return [tesseractEngine];
  }

  if (strategyId === "tesseract-wasm") {
    return [tesseractWasmEngine];
  }

  return [tesseractEngine, paddleEngine, tesseractWasmEngine];
}

const tesseractEngine: OcrEngine<OcrImage> = {
  id: "tesseract",
  label: "Tesseract.js",
  extractText: (image) => extractImageText(image, 1, "ocr:tesseract"),
  maxTileConcurrency: 3
};

const paddleEngine: OcrEngine<OcrImage> = {
  id: "paddle",
  label: "PaddleOCR.js",
  extractText: extractPaddleText,
  consumeSetupDurationMs: consumePaddleSetupDurationMs,
  maxTileConcurrency: 1
};

const tesseractWasmEngine: OcrEngine<OcrImage> = {
  id: "tesseract-wasm",
  label: "tesseract-wasm",
  extractText: extractTesseractWasmText,
  maxTileConcurrency: 1
};

let paddleOcrPromise: Promise<{
  predict: (image: Exclude<OcrImage, string>) => Promise<Array<{
    image: { width: number; height: number };
    items: Array<{
      poly: Point2D[];
      text: string;
      score: number;
    }>;
  }>>;
}> | undefined;
let pendingPaddleSetupDurationMs: number | undefined;

let tesseractWasmClientPromise: Promise<OCRClient> | undefined;

async function extractPaddleText(image: OcrImage): Promise<ExtractedTextItem[]> {
  if (shouldSkipPaddleOcr(getBrowserRuntimeInfo())) {
    throw new Error(
      "PaddleOCR skipped on this browser because its WASM/ONNX runtime is likely to reload the tab. Use Tesseract.js or tesseract-wasm on iOS/mobile."
    );
  }

  if (typeof image === "string") {
    throw new Error("PaddleOCR browser mode needs a File, Blob, or canvas image.");
  }

  const ocr = await getPaddleOcr();
  const [result] = await ocr.predict(image);

  return result.items.flatMap((item): ExtractedTextItem[] => {
    const text = item.text.trim();
    if (!text || item.score < 0.2) {
      return [];
    }

    const bounds = getPolygonBounds(item.poly);
    return [{
      text,
      page: 1,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      source: "ocr:paddle"
    }];
  });
}

async function getPaddleOcr() {
  if (!paddleOcrPromise) {
    const startedAt = now();
    paddleOcrPromise = import("@paddleocr/paddleocr-js").then(async ({ PaddleOCR }) => {
      const instance = await PaddleOCR.create({
        textDetectionModelName: "PP-OCRv5_mobile_det",
        textRecognitionModelName: "PP-OCRv5_mobile_rec",
        textDetectionModelAsset: {
          url: `${PADDLE_MODEL_BASE_URL}/PP-OCRv5_mobile_det_onnx_infer.tar`
        },
        textRecognitionModelAsset: {
          url: `${PADDLE_MODEL_BASE_URL}/PP-OCRv5_mobile_rec_onnx_infer.tar`
        },
        ortOptions: {
          backend: "auto"
        }
      });
      pendingPaddleSetupDurationMs = now() - startedAt;
      return instance;
    });
  }

  return paddleOcrPromise;
}

function consumePaddleSetupDurationMs(): number | undefined {
  const duration = pendingPaddleSetupDurationMs;
  pendingPaddleSetupDurationMs = undefined;
  return duration;
}

function getPolygonBounds(poly: Point2D[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const xs = poly.map((point) => getPointCoordinate(point, "x"));
  const ys = poly.map((point) => getPointCoordinate(point, "y"));
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x,
    y,
    width: maxX - x,
    height: maxY - y
  };
}

function getPointCoordinate(point: Point2D, axis: "x" | "y"): number {
  return Number(point[axis === "x" ? 0 : 1]) || 0;
}

async function extractTesseractWasmText(image: OcrImage): Promise<ExtractedTextItem[]> {
  const client = await getTesseractWasmClient();
  const imageBitmapOrData = await loadTesseractWasmImage(image);

  await client.clearImage();
  await client.loadImage(imageBitmapOrData);

  const boxes = await client.getTextBoxes("word");
  closeImageBitmap(imageBitmapOrData);

  return boxes.flatMap((box): ExtractedTextItem[] => {
    const text = box.text.trim();
    if (!text || box.confidence < 0.2) {
      return [];
    }

    return [{
      text,
      page: 1,
      x: box.rect.left,
      y: box.rect.top,
      width: box.rect.right - box.rect.left,
      height: box.rect.bottom - box.rect.top,
      source: "ocr:tesseract-wasm"
    }];
  });
}

async function getTesseractWasmClient(): Promise<OCRClient> {
  tesseractWasmClientPromise ??= createTesseractWasmClient();
  return tesseractWasmClientPromise;
}

async function createTesseractWasmClient(): Promise<OCRClient> {
  const wasmName = supportsFastBuild()
    ? tesseractWasmFastUrl
    : tesseractWasmFallbackUrl;
  const wasmBinary = await fetchArrayBuffer(wasmName);
  const client = new OCRClient({
    workerURL: tesseractWasmWorkerUrl,
    wasmBinary
  });

  await client.loadModel(TESSERACT_WASM_MODEL_URL);
  return client;
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url}: HTTP ${response.status}`);
  }

  return response.arrayBuffer();
}

async function loadTesseractWasmImage(
  image: OcrImage
): Promise<ImageBitmap | ImageData> {
  if (typeof image === "string") {
    return createImageBitmap(await fetchImageBlob(image));
  }

  if (image instanceof HTMLCanvasElement) {
    const context = image.getContext("2d");
    if (!context) {
      throw new Error("Could not read canvas image data for tesseract-wasm.");
    }

    return context.getImageData(0, 0, image.width, image.height);
  }

  return createImageBitmap(image);
}

async function fetchImageBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load image ${url}: HTTP ${response.status}`);
  }

  return response.blob();
}

function closeImageBitmap(image: ImageBitmap | ImageData): void {
  if ("close" in image) {
    image.close();
  }
}

export type BrowserRuntimeInfo = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  deviceMemory?: number;
};

export function shouldSkipPaddleOcr({
  userAgent,
  platform,
  maxTouchPoints,
  deviceMemory
}: BrowserRuntimeInfo): boolean {
  const isIos = /iPad|iPhone|iPod/u.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1);
  const isMobileWebKit = /Mobile\/.+Safari/u.test(userAgent) &&
    /AppleWebKit/u.test(userAgent);

  return isIos || isMobileWebKit || (deviceMemory !== undefined && deviceMemory <= 2);
}

function getBrowserRuntimeInfo(): BrowserRuntimeInfo {
  if (typeof navigator === "undefined") {
    return {
      userAgent: "",
      platform: "",
      maxTouchPoints: 0
    };
  }

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    deviceMemory: getDeviceMemory()
  };
}

function getDeviceMemory(): number | undefined {
  const maybeNavigator = navigator as Navigator & { deviceMemory?: number };
  return maybeNavigator.deviceMemory;
}

function now(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}
