import type { ExtractedTextItem } from "../../types/floorPlan";

const MIN_OCR_CONFIDENCE = 20;

export function parseTesseractTsv(
  tsv: string | null | undefined,
  page: number
): ExtractedTextItem[] {
  if (!tsv) {
    return [];
  }

  const allLines = tsv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const [firstLine] = allLines;
  if (!firstLine) {
    return [];
  }

  const firstColumns = firstLine.split("\t");
  const hasHeader = firstColumns.includes("level") && firstColumns.includes("text");
  const headers = hasHeader ? firstColumns : [];
  const lines = hasHeader ? allLines.slice(1) : allLines;
  const index = (name: string, fallback: number) => {
    const headerIndex = headers.indexOf(name);
    return headerIndex === -1 ? fallback : headerIndex;
  };
  const levelIndex = index("level", 0);
  const leftIndex = index("left", 6);
  const topIndex = index("top", 7);
  const widthIndex = index("width", 8);
  const heightIndex = index("height", 9);
  const confidenceIndex = index("conf", 10);
  const textIndex = index("text", 11);

  return lines.flatMap((line): ExtractedTextItem[] => {
    if (!line.trim()) {
      return [];
    }

    const columns = line.split("\t");
    const text = columns.slice(textIndex).join("\t").trim();
    const confidence = Number(columns[confidenceIndex]);
    const isWord = columns[levelIndex] === "5";

    if (!isWord || !text || confidence < MIN_OCR_CONFIDENCE) {
      return [];
    }

    return [
      {
        text,
        page,
        x: Number(columns[leftIndex]),
        y: Number(columns[topIndex]),
        width: Number(columns[widthIndex]),
        height: Number(columns[heightIndex]),
      source: "ocr:tesseract"
      }
    ];
  });
}
