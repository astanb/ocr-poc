import { describe, expect, it } from "vitest";
import type { ExtractedTextItem } from "../../types/floorPlan";
import type { RoomListItem } from "../../types/rooms";
import { runOcrMatchPipeline, type OcrEngine } from "./ocrPipeline";

const room = (
  id: string,
  rawName: string,
  normalizedName: string,
  possibleCode?: string
): RoomListItem => ({ id, rawName, normalizedName, possibleCode });

const item = (
  text: string,
  x: number,
  source: ExtractedTextItem["source"]
): ExtractedTextItem => ({
  text,
  page: 1,
  x,
  y: 10,
  width: 80,
  height: 12,
  source
});

const engine = (
  id: string,
  label: string,
  textItems: ExtractedTextItem[]
): OcrEngine<string> => ({
  id,
  label,
  extractText: async () => textItems
});

describe("runOcrMatchPipeline", () => {
  it("scores each OCR engine and selects the best single-engine attempt by matched count", async () => {
    const rooms = [
      room("room-1", "GF001 - Store", "gf001 store", "GF001"),
      room("room-2", "GF002 - Office", "gf002 office", "GF002")
    ];

    const result = await runOcrMatchPipeline({
      image: "fixture",
      rooms,
      engines: [
        engine("weak", "Weak OCR", [item("GF001 Store", 10, "ocr:weak")]),
        engine("strong", "Strong OCR", [
          item("GF001 Store", 10, "ocr:strong"),
          item("GF002 Office", 120, "ocr:strong")
        ])
      ]
    });

    expect(result.bestAttempt?.engineId).toBe("strong");
    expect(result.bestAttempt?.stats.matched).toBe(2);
    expect(result.matches.filter((match) => match.status === "matched")).toHaveLength(2);
  });

  it("builds a combined result from the best room match across engines", async () => {
    const rooms = [
      room("room-1", "GF001 - Store", "gf001 store", "GF001"),
      room("room-2", "GF002 - Office", "gf002 office", "GF002")
    ];

    const result = await runOcrMatchPipeline({
      image: "fixture",
      rooms,
      engines: [
        engine("left", "Left OCR", [item("GF001 Store", 10, "ocr:left")]),
        engine("right", "Right OCR", [item("GF002 Office", 120, "ocr:right")])
      ]
    });

    expect(result.bestAttempt?.stats.matched).toBe(1);
    expect(result.stats.matched).toBe(2);
    expect(result.matches.map((match) => match.matchedSource)).toEqual([
      "ocr:left",
      "ocr:right"
    ]);
  });

  it("keeps successful engine results when another comparison engine fails", async () => {
    const rooms = [room("room-1", "GF001 - Store", "gf001 store", "GF001")];

    const result = await runOcrMatchPipeline({
      image: "fixture",
      rooms,
      engines: [
        engine("working", "Working OCR", [item("GF001 Store", 10, "ocr:working")]),
        {
          id: "broken",
          label: "Broken OCR",
          extractText: async () => {
            throw new Error("OCR model did not load");
          }
        }
      ]
    });

    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[1]).toMatchObject({
      engineId: "broken",
      errorMessage: "OCR model did not load",
      stats: {
        matched: 0,
        ambiguous: 0,
        unmatched: 1
      }
    });
    expect(result.stats.matched).toBe(1);
  });
});
