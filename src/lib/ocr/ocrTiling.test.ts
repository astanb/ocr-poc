import { describe, expect, it } from "vitest";
import type { ExtractedTextItem } from "../../types/floorPlan";
import {
  dedupeOcrTextItems,
  mapTileTextItemsToPage,
  planOcrTiles
} from "./ocrTiling";

describe("planOcrTiles", () => {
  it("splits a page into overlapping tiles that cover the full coordinate space", () => {
    const tiles = planOcrTiles({
      width: 2500,
      height: 1800,
      tileSize: 1000,
      overlap: 100
    });

    expect(tiles[0]).toMatchObject({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000
    });
    expect(tiles.at(-1)).toMatchObject({
      x: 1500,
      y: 800,
      width: 1000,
      height: 1000
    });
    expect(tiles.length).toBe(6);
  });
});

describe("mapTileTextItemsToPage", () => {
  it("converts tile-local OCR coordinates back to page coordinates", () => {
    const [item] = mapTileTextItemsToPage(
      [ocrItem("GF001", 20, 30, 50, 10)],
      {
        id: "tile-1",
        x: 400,
        y: 700,
        width: 1000,
        height: 1000
      }
    );

    expect(item).toMatchObject({
      text: "GF001",
      x: 420,
      y: 730,
      width: 50,
      height: 10
    });
  });
});

describe("dedupeOcrTextItems", () => {
  it("deduplicates matching OCR words from overlapping tiles", () => {
    const items = dedupeOcrTextItems([
      ocrItem("GF001", 100, 100, 40, 12),
      ocrItem("GF001", 102, 101, 40, 12),
      ocrItem("GF002", 180, 100, 40, 12)
    ]);

    expect(items.map((item) => item.text)).toEqual(["GF001", "GF002"]);
  });
});

function ocrItem(
  text: string,
  x: number,
  y: number,
  width: number,
  height: number
): ExtractedTextItem {
  return {
    text,
    page: 1,
    x,
    y,
    width,
    height,
    source: "ocr:test"
  };
}
