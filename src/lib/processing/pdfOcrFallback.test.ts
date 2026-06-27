import { describe, expect, it } from "vitest";
import type { RoomMatch } from "../../types/matching";
import type { RoomListItem } from "../../types/rooms";
import { getRoomsNeedingOcrRetry, mergePdfMatchesWithOcrRetries } from "./pdfOcrFallback";

const room = (id: string): RoomListItem => ({
  id,
  rawName: id,
  normalizedName: id
});

const match = (
  roomId: string,
  confidence: number,
  matchedSource: RoomMatch["matchedSource"]
): RoomMatch => ({
  roomId,
  roomRawName: roomId,
  matchedSource,
  confidence,
  status: confidence > 0 ? "matched" : "unmatched",
  reason: `${matchedSource} match`
});

describe("getRoomsNeedingOcrRetry", () => {
  it("selects only rooms below the confidence threshold", () => {
    expect(
      getRoomsNeedingOcrRetry(
        [room("high"), room("low"), room("missing")],
        [match("high", 0.9, "pdf-text"), match("low", 0.89, "pdf-text")]
      ).map((value) => value.id)
    ).toEqual(["low", "missing"]);
  });
});

describe("mergePdfMatchesWithOcrRetries", () => {
  it("keeps high-confidence PDF matches and only replaces lower-confidence matches when OCR improves them", () => {
    expect(
      mergePdfMatchesWithOcrRetries(
        [
          match("high", 0.95, "pdf-text"),
          match("improved", 0.62, "pdf-text"),
          match("not-improved", 0.7, "pdf-text")
        ],
        [match("improved", 0.9, "ocr"), match("not-improved", 0.4, "ocr")]
      )
    ).toMatchObject([
      { roomId: "high", matchedSource: "pdf-text", confidence: 0.95 },
      { roomId: "improved", matchedSource: "ocr", confidence: 0.9 },
      { roomId: "not-improved", matchedSource: "pdf-text", confidence: 0.7 }
    ]);
  });
});
