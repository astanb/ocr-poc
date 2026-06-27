export type OcrPreprocessingPassId =
  | "raw"
  | "grayscale-contrast"
  | "threshold"
  | "inverted";

export type OcrPreprocessingPass = {
  id: OcrPreprocessingPassId;
  label: string;
};

export type OcrPassCanvas = OcrPreprocessingPass & {
  canvas: HTMLCanvasElement;
};

export const OCR_PREPROCESSING_PASSES: OcrPreprocessingPass[] = [
  { id: "raw", label: "Raw high-resolution render" },
  { id: "grayscale-contrast", label: "Grayscale + contrast boost" },
  { id: "threshold", label: "Threshold / binarised" },
  { id: "inverted", label: "Inverted threshold" }
];

const CONTRAST_FACTOR = 1.45;
const THRESHOLD = 150;

export function createOcrPassCanvases(
  source: HTMLCanvasElement,
  passes = OCR_PREPROCESSING_PASSES
): OcrPassCanvas[] {
  return passes.map((pass) => ({
    ...pass,
    canvas: createPassCanvas(source, pass.id)
  }));
}

function createPassCanvas(
  source: HTMLCanvasElement,
  passId: OcrPreprocessingPassId
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;

  const context = getCanvasContext(canvas);
  context.drawImage(source, 0, 0);

  if (passId === "raw") {
    return canvas;
  }

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  applyOcrPreprocessingToImageData(imageData, passId);
  context.putImageData(imageData, 0, 0);
  return canvas;
}

export function applyOcrPreprocessingToImageData(
  imageData: ImageData,
  passId: OcrPreprocessingPassId
): ImageData {
  if (passId === "raw") {
    return imageData;
  }

  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const gray = Math.round(
      0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]
    );
    const contrasted = clamp((gray - 128) * CONTRAST_FACTOR + 128);

    if (passId === "grayscale-contrast") {
      data[index] = contrasted;
      data[index + 1] = contrasted;
      data[index + 2] = contrasted;
      continue;
    }

    const binary = contrasted >= THRESHOLD ? 255 : 0;
    const value = passId === "inverted" ? 255 - binary : binary;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }

  return imageData;
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Could not create OCR preprocessing canvas.");
  }

  return context;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
