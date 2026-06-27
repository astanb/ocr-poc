import { pdfjsLib } from "./pdfjs";
import type { RenderedPage } from "../../types/floorPlan";

const OCR_TARGET_DPI = 300;
const PDF_POINTS_PER_INCH = 72;
const MAX_CANVAS_DIMENSION = 8_192;
const MAX_CANVAS_PIXELS = 36_000_000;

export type PdfRenderScaleOptions = {
  width: number;
  height: number;
  targetDpi?: number;
  maxCanvasDimension?: number;
  maxCanvasPixels?: number;
};

export async function renderPdfPage(
  file: File,
  pageNumber = 1
): Promise<RenderedPage> {
  const data = await file.arrayBuffer();
  const pdfDocument = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdfDocument.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = calculatePdfRenderScale({
    width: baseViewport.width,
    height: baseViewport.height
  });
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create a canvas context for PDF rendering.");
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({
    canvas,
    canvasContext: context,
    viewport
  }).promise;

  return {
    page: pageNumber,
    width: canvas.width,
    height: canvas.height,
    scale,
    canvas
  };
}

export function calculatePdfRenderScale({
  width,
  height,
  targetDpi = OCR_TARGET_DPI,
  maxCanvasDimension = MAX_CANVAS_DIMENSION,
  maxCanvasPixels = MAX_CANVAS_PIXELS
}: PdfRenderScaleOptions): number {
  const targetScale = targetDpi / PDF_POINTS_PER_INCH;
  const dimensionScale = Math.min(
    maxCanvasDimension / width,
    maxCanvasDimension / height
  );
  const pixelScale = Math.sqrt(maxCanvasPixels / (width * height));

  return Math.min(targetScale, dimensionScale, pixelScale);
}
