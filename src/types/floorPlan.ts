export type TextSource = "pdf-text" | "ocr";

export type ExtractedTextItem = {
  text: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  source: TextSource;
};

export type ExtractedLabelCandidate = {
  id: string;
  rawText: string;
  normalizedText: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  source: TextSource | "mixed";
  childItems: ExtractedTextItem[];
};

export type RenderedPage = {
  page: number;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
};
