import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("runs engines over preprocessing passes and preserves pass labels in attempts", async () => {
    const rooms = [room("room-1", "GF001 - Store", "gf001 store", "GF001")];

    const result = await runOcrMatchPipeline({
      image: "raw-image",
      rooms,
      engines: [
        {
          id: "pass-aware",
          label: "Pass aware OCR",
          extractText: async (image) =>
            image === "threshold-image"
              ? [item("GF001 Store", 10, "ocr:pass-aware")]
              : []
        }
      ],
      passes: [
        { id: "raw", label: "Raw", image: "raw-image" },
        { id: "threshold", label: "Threshold", image: "threshold-image" }
      ]
    });

    expect(result.attempts.map((attempt) => attempt.passId)).toEqual([
      "raw",
      "threshold"
    ]);
    expect(result.bestAttempt).toMatchObject({
      engineId: "pass-aware",
      passId: "threshold",
      stats: {
        matched: 1
      }
    });
    expect(result.stats.matched).toBe(1);
  });

  it("runs tiled pass attempts by mapping tile coordinates back to page coordinates and deduping", async () => {
    const rooms = [room("room-1", "GF001 - Store", "gf001 store", "GF001")];

    const result = await runOcrMatchPipeline({
      image: "full",
      rooms,
      engines: [
        {
          id: "tile-engine",
          label: "Tile OCR",
          extractText: async (image) =>
            image === "tile-a" || image === "tile-b"
              ? [item("GF001 Store", 10, "ocr:tile-engine")]
              : []
        }
      ],
      passes: [
        {
          id: "raw",
          label: "Raw",
          image: "full",
          tiledImages: [
            {
              id: "tile-a",
              label: "Tile A",
              image: "tile-a",
              x: 100,
              y: 200,
              width: 1000,
              height: 1000
            },
            {
              id: "tile-b",
              label: "Tile B",
              image: "tile-b",
              x: 102,
              y: 201,
              width: 1000,
              height: 1000
            }
          ]
        }
      ]
    });

    const tiledAttempt = result.attempts.find((attempt) => attempt.tileMode === "tiled");

    expect(tiledAttempt).toMatchObject({
      passId: "raw",
      tileMode: "tiled",
      tileCount: 2,
      stats: {
        matched: 1
      }
    });
    expect(tiledAttempt?.textItems).toHaveLength(1);
    expect(tiledAttempt?.textItems[0]).toMatchObject({
      x: 110,
      y: 210
    });
  });

  it("emits failed progress for the tile that fails", async () => {
    const rooms = [room("room-1", "GF001 - Store", "gf001 store", "GF001")];
    const progress: string[] = [];

    await runOcrMatchPipeline({
      image: "full",
      rooms,
      engines: [
        {
          id: "tile-engine",
          label: "Tile OCR",
          extractText: async (image) => {
            if (image === "tile-b") {
              throw new Error("tile could not be read");
            }
            return [];
          }
        }
      ],
      passes: [
        {
          id: "raw",
          label: "Raw",
          image: "full",
          tiledImages: [
            {
              id: "tile-a",
              label: "Tile A",
              image: "tile-a",
              x: 0,
              y: 0,
              width: 1000,
              height: 1000
            },
            {
              id: "tile-b",
              label: "Tile B",
              image: "tile-b",
              x: 100,
              y: 0,
              width: 1000,
              height: 1000
            }
          ]
        }
      ],
      onProgress: (step) => progress.push(step.message)
    });

    expect(progress).toContain("failed: Tile OCR / Raw / tile 2/2");
  });

  it("separates one-time engine setup time from OCR attempt time", async () => {
    const rooms = [room("room-1", "GF001 - Store", "gf001 store", "GF001")];
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(160);

    const result = await runOcrMatchPipeline({
      image: "fixture",
      rooms,
      engines: [
        {
          id: "setup-heavy",
          label: "Setup Heavy OCR",
          extractText: async () => [item("GF001 Store", 10, "ocr:setup-heavy")],
          consumeSetupDurationMs: () => 10_000
        }
      ]
    });

    expect(result.attempts[0].setupDurationMs).toBe(10_000);
    expect(result.attempts[0].durationMs).toBe(0);
  });

  it("does not merge several room matches onto the same pin coordinate", async () => {
    const rooms = [
      room("room-1", "GF001 - Circulation", "gf001 circulation", "GF001"),
      room("room-2", "GF001A - Circulation", "gf001a circulation", "GF001A")
    ];

    const result = await runOcrMatchPipeline({
      image: "fixture",
      rooms,
      engines: [
        engine("first", "First OCR", [
          item("GF001 Circulation", 10, "ocr:first")
        ]),
        engine("second", "Second OCR", [
          item("GF001A Circulation", 10, "ocr:second")
        ])
      ]
    });

    const pinnedMatches = result.matches.filter((match) => match.x !== undefined);

    expect(pinnedMatches).toHaveLength(1);
    expect(result.matches[1]).toMatchObject({
      roomId: "room-2",
      status: "unmatched"
    });
  });
});
