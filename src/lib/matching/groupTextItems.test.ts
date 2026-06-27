import { describe, expect, it } from "vitest";
import type { ExtractedTextItem } from "../../types/floorPlan";
import { groupTextItems } from "./groupTextItems";

const item = (
  text: string,
  x: number,
  y: number,
  width = text.length * 6
): ExtractedTextItem => ({
  text,
  page: 1,
  x,
  y,
  width,
  height: 10,
  source: "pdf-text"
});

describe("groupTextItems", () => {
  it("merges nearby chunks on the same line into a label candidate", () => {
    const candidates = groupTextItems([
      item("GF004", 10, 20, 30),
      item("General", 48, 21, 42),
      item("Teaching", 96, 20, 48),
      item("Plant", 300, 22, 30)
    ]);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      rawText: "GF004 General Teaching",
      page: 1,
      x: 10,
      y: 20,
      width: 134,
      source: "pdf-text"
    });
    expect(candidates[0]?.childItems.map((child) => child.text)).toEqual([
      "GF004",
      "General",
      "Teaching"
    ]);
  });

  it("merges stacked room-name and room-code text when their centres align", () => {
    const candidates = groupTextItems([
      item("Teaching Area", 100, 20, 78),
      item("G046", 128, 36, 24),
      item("Girls WC", 260, 20, 46),
      item("G046", 270, 36, 24)
    ]);

    expect(candidates.map((candidate) => candidate.rawText)).toEqual([
      "Teaching Area G046",
      "Girls WC G046"
    ]);
  });
});
