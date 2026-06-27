import { describe, expect, it } from "vitest";
import type { RoomMatch } from "../types/matching";
import { summarizeMatchSources } from "./ResultsTable";

const match = (
  roomId: string,
  matchedSource: RoomMatch["matchedSource"],
  status: RoomMatch["status"] = "matched"
): RoomMatch => ({
  roomId,
  roomRawName: roomId,
  matchedSource,
  status,
  confidence: status === "unmatched" ? 0 : 0.9,
  reason: "test"
});

describe("summarizeMatchSources", () => {
  it("counts final match sources for the top-level results summary", () => {
    expect(
      summarizeMatchSources([
        match("pdf", "pdf-text"),
        match("ocr", "ocr:tesseract"),
        match("mixed", "mixed"),
        match("unmatched", undefined, "unmatched")
      ])
    ).toEqual({
      total: 4,
      pdfText: 1,
      ocr: 1,
      mixed: 1,
      unmatched: 1
    });
  });
});
