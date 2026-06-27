import { describe, expect, it } from "vitest";
import type { OcrAttempt } from "../lib/ocr/ocrPipeline";
import type { RoomMatch } from "../types/matching";
import {
  formatOcrAttemptSummary,
  getUniqueRoomsFoundCount,
  sortOcrAttemptsByMatches,
  summarizeMatchSources
} from "./ResultsTable";

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

describe("formatOcrAttemptSummary", () => {
  it("makes full-page and tiled attempts separately visible", () => {
    const baseAttempt: OcrAttempt = {
      engineId: "paddle",
      engineLabel: "PaddleOCR.js",
      passId: "raw",
      passLabel: "Raw high-resolution render",
      durationMs: 1234,
      textItems: [],
      candidates: [],
      matches: [
        match("room-1", "ocr:paddle"),
        match("room-2", "ocr:paddle"),
        match("room-3", "ocr:paddle", "ambiguous"),
        match("missing", undefined, "unmatched")
      ],
      stats: {
        matched: 7,
        ambiguous: 0,
        unmatched: 2
      }
    };

    expect(
      formatOcrAttemptSummary({
        ...baseAttempt,
        tileMode: "full-page",
        setupDurationMs: 5678
      })
    ).toBe(
      "PaddleOCR.js / Raw high-resolution render / full page: 3 unique rooms, 7 matched, setup 5678ms, OCR 1234ms"
    );

    expect(
      formatOcrAttemptSummary({
        ...baseAttempt,
        tileMode: "tiled",
        tileCount: 4
      })
    ).toBe(
      "PaddleOCR.js / Raw high-resolution render / tiled x4: 3 unique rooms, 7 matched, OCR 1234ms"
    );
  });

  it("labels PDF text attempts separately from OCR attempts", () => {
    expect(
      formatOcrAttemptSummary({
        engineId: "pdf-text",
        engineLabel: "PDF.js",
        passLabel: "Text extraction",
        durationMs: 42,
        textItems: [],
        candidates: [],
        matches: [match("room-1", "pdf-text")],
        stats: {
          matched: 1,
          ambiguous: 0,
          unmatched: 0
        }
      })
    ).toBe("PDF.js / Text extraction: 1 unique rooms, 1 matched, PDF 42ms");
  });
});

describe("getUniqueRoomsFoundCount", () => {
  it("counts distinct non-unmatched room results for an OCR attempt", () => {
    expect(
      getUniqueRoomsFoundCount({
        engineId: "ocr",
        engineLabel: "OCR",
        durationMs: 0,
        textItems: [],
        candidates: [],
        matches: [
          match("room-1", "ocr:test"),
          match("room-1", "ocr:test", "ambiguous"),
          match("room-2", "ocr:test", "corrected"),
          match("room-3", undefined, "unmatched")
        ],
        stats: {
          matched: 1,
          ambiguous: 1,
          unmatched: 1
        }
      })
    ).toBe(2);
  });
});

describe("sortOcrAttemptsByMatches", () => {
  it("orders attempts by unique rooms, then matched count, ambiguity, and duration", () => {
    const attempt = (
      engineId: string,
      matched: number,
      ambiguous: number,
      durationMs: number,
      uniqueRooms = matched + ambiguous
    ): OcrAttempt => ({
      engineId,
      engineLabel: engineId,
      durationMs,
      textItems: [],
      candidates: [],
      matches: Array.from({ length: uniqueRooms }, (_, index) =>
        match(`${engineId}-${index + 1}`, `ocr:${engineId}`)
      ),
      stats: {
        matched,
        ambiguous,
        unmatched: 0
      }
    });

    expect(
      sortOcrAttemptsByMatches([
        attempt("slow-less-useful", 2, 0, 100),
        attempt("most-useful", 4, 0, 500),
        attempt("ambiguous-tie", 4, 1, 400),
        attempt("faster-tie", 4, 0, 200),
        attempt("more-unique", 3, 0, 900, 6)
      ]).map((attempt) => attempt.engineId)
    ).toEqual([
      "more-unique",
      "ambiguous-tie",
      "faster-tie",
      "most-useful",
      "slow-less-useful"
    ]);
  });
});
