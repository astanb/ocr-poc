import { pdfjsLib } from "./pdfjs";
import type { RenderedPage } from "../../types/floorPlan";

export async function renderPdfPage(
  file: File,
  pageNumber = 1,
  scale = 1.5
): Promise<RenderedPage> {
  const data = await file.arrayBuffer();
  const pdfDocument = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdfDocument.getPage(pageNumber);
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
    canvas
  };
}
