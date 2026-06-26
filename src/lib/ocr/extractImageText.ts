import { createWorker } from "tesseract.js";
import type { ExtractedTextItem } from "../../types/floorPlan";

type TesseractWord = {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
};

export async function extractImageText(
  image: File | Blob | HTMLCanvasElement,
  page = 1
): Promise<ExtractedTextItem[]> {
  const worker = await createWorker("eng");

  try {
    const result = await worker.recognize(image);
    const words = getWords(result.data);

    return words.flatMap((word): ExtractedTextItem[] => {
      const text = word.text.trim();
      if (!text || word.confidence < 20) {
        return [];
      }

      return [{
        text,
        page,
        x: word.bbox.x0,
        y: word.bbox.y0,
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0,
        source: "ocr"
      }];
    });
  } finally {
    await worker.terminate();
  }
}

function getWords(data: unknown): TesseractWord[] {
  if (
    typeof data === "object" &&
    data !== null &&
    "words" in data &&
    Array.isArray(data.words)
  ) {
    return data.words.filter(isWord);
  }

  return [];
}

function isWord(value: unknown): value is TesseractWord {
  return (
    typeof value === "object" &&
    value !== null &&
    "text" in value &&
    "confidence" in value &&
    "bbox" in value
  );
}
