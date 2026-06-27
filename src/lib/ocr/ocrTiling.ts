import type { ExtractedTextItem } from "../../types/floorPlan";

export type OcrTile = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrTilePlanOptions = {
  width: number;
  height: number;
  tileSize?: number;
  overlap?: number;
};

const DEFAULT_TILE_SIZE = 1200;
const DEFAULT_TILE_OVERLAP = 120;
const DEDUPE_POSITION_TOLERANCE = 8;

export function planOcrTiles({
  width,
  height,
  tileSize = DEFAULT_TILE_SIZE,
  overlap = DEFAULT_TILE_OVERLAP
}: OcrTilePlanOptions): OcrTile[] {
  if (width <= tileSize && height <= tileSize) {
    return [{ id: "tile-1", x: 0, y: 0, width, height }];
  }

  const xs = planAxisStarts(width, tileSize, overlap);
  const ys = planAxisStarts(height, tileSize, overlap);

  return ys.flatMap((y, rowIndex) =>
    xs.map((x, columnIndex) => ({
      id: `tile-${rowIndex + 1}-${columnIndex + 1}`,
      x,
      y,
      width: Math.min(tileSize, width - x),
      height: Math.min(tileSize, height - y)
    }))
  );
}

export function createOcrTileCanvases(source: HTMLCanvasElement): Array<OcrTile & {
  canvas: HTMLCanvasElement;
}> {
  return planOcrTiles({
    width: source.width,
    height: source.height
  }).map((tile) => ({
    ...tile,
    canvas: createTileCanvas(source, tile)
  }));
}

export function mapTileTextItemsToPage(
  items: ExtractedTextItem[],
  tile: OcrTile
): ExtractedTextItem[] {
  return items.map((item) => ({
    ...item,
    x: item.x + tile.x,
    y: item.y + tile.y
  }));
}

export function dedupeOcrTextItems(items: ExtractedTextItem[]): ExtractedTextItem[] {
  const deduped: ExtractedTextItem[] = [];

  for (const item of items) {
    const duplicate = deduped.find((existing) => isDuplicateTextItem(existing, item));
    if (!duplicate) {
      deduped.push(item);
    }
  }

  return deduped;
}

function planAxisStarts(
  length: number,
  tileSize: number,
  overlap: number
): number[] {
  const step = Math.max(1, tileSize - overlap);
  const starts: number[] = [];
  let current = 0;

  while (current + tileSize < length) {
    starts.push(current);
    current += step;
  }

  starts.push(Math.max(0, length - tileSize));
  return [...new Set(starts)];
}

function createTileCanvas(source: HTMLCanvasElement, tile: OcrTile): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = tile.width;
  canvas.height = tile.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create OCR tile canvas.");
  }

  context.drawImage(
    source,
    tile.x,
    tile.y,
    tile.width,
    tile.height,
    0,
    0,
    tile.width,
    tile.height
  );

  return canvas;
}

function isDuplicateTextItem(
  left: ExtractedTextItem,
  right: ExtractedTextItem
): boolean {
  return normalizeToken(left.text) === normalizeToken(right.text) &&
    Math.abs(left.x - right.x) <= DEDUPE_POSITION_TOLERANCE &&
    Math.abs(left.y - right.y) <= DEDUPE_POSITION_TOLERANCE;
}

function normalizeToken(text: string): string {
  return text.trim().toLowerCase();
}
