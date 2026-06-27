import type { Point2D } from "@paddleocr/paddleocr-js";
import type { ExtractedTextItem } from "../../types/floorPlan";
import { extractImageText } from "./extractImageText";
import type { OcrEngine } from "./ocrPipeline";

type OcrImage = File | Blob | HTMLCanvasElement | string;

export type OcrEngineId = "tesseract" | "paddle";
export type OcrStrategyId =
  | "tesseract"
  | "paddle"
  | "compare-tesseract-paddle";

export const OCR_STRATEGIES: Array<{
  id: OcrStrategyId;
  label: string;
  description: string;
}> = [
  {
    id: "compare-tesseract-paddle",
    label: "Compare Tesseract + Paddle",
    description: "Run both OCR engines and keep the best room matches."
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
  }
];

export function getOcrEngines(strategyId: OcrStrategyId): OcrEngine<OcrImage>[] {
  if (strategyId === "paddle") {
    return [paddleEngine];
  }

  if (strategyId === "tesseract") {
    return [tesseractEngine];
  }

  return [tesseractEngine, paddleEngine];
}

const tesseractEngine: OcrEngine<OcrImage> = {
  id: "tesseract",
  label: "Tesseract.js",
  extractText: (image) => extractImageText(image, 1, "ocr:tesseract")
};

const paddleEngine: OcrEngine<OcrImage> = {
  id: "paddle",
  label: "PaddleOCR.js",
  extractText: extractPaddleText
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

async function extractPaddleText(image: OcrImage): Promise<ExtractedTextItem[]> {
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
  paddleOcrPromise ??= import("@paddleocr/paddleocr-js").then(({ PaddleOCR }) =>
    PaddleOCR.create({
      textDetectionModelName: "PP-OCRv5_mobile_det",
      textRecognitionModelName: "PP-OCRv5_mobile_rec",
      ortOptions: {
        backend: "auto",
        wasmPaths: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/"
      }
    })
  );

  return paddleOcrPromise;
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
