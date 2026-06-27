import type { ExtractedTextItem } from "../../types/floorPlan";
import { pdfjsLib } from "./pdfjs";

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

export async function extractPdfText(
  file: File,
  pageNumber?: number,
  scale = 1.5
): Promise<ExtractedTextItem[]> {
  const data = await file.arrayBuffer();
  return extractPdfTextFromArrayBuffer(data, pageNumber, scale);
}

export async function extractPdfTextFromArrayBuffer(
  data: ArrayBuffer | Uint8Array,
  pageNumber?: number,
  scale = 1.5
): Promise<ExtractedTextItem[]> {
  const document = await pdfjsLib.getDocument({ data }).promise;
  const pageNumbers =
    pageNumber === undefined
      ? Array.from({ length: document.numPages }, (_, index) => index + 1)
      : [pageNumber];
  const items = await Promise.all(
    pageNumbers.map((currentPage) => extractPdfPageText(document, currentPage, scale))
  );

  return items.flat();
}

async function extractPdfPageText(
  document: Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>,
  pageNumber: number,
  scale: number
): Promise<ExtractedTextItem[]> {
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const content = await page.getTextContent();

  return content.items.flatMap((item): ExtractedTextItem[] => {
    if (!isPdfTextItem(item) || item.str.trim().length === 0) {
      return [];
    }

    const transformed = pdfjsLib.Util.transform(
      viewport.transform,
      item.transform
    );
    const x = transformed[4];
    const y = transformed[5] - item.height * scale;

    return [{
      text: item.str,
      page: pageNumber,
      x,
      y,
      width: item.width * scale,
      height: item.height * scale,
      source: "pdf-text"
    }];
  });
}

function isPdfTextItem(item: unknown): item is PdfTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    "transform" in item &&
    "width" in item &&
    "height" in item
  );
}
