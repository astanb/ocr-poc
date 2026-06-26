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
  pageNumber = 1,
  scale = 1.5
): Promise<ExtractedTextItem[]> {
  const data = await file.arrayBuffer();
  const document = await pdfjsLib.getDocument({ data }).promise;
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
