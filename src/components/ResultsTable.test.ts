import { describe, expect, it } from "vitest";
import type { OcrAttempt } from "../lib/ocr/ocrPipeline";
import type { RoomMatch } from "../types/matching";
import {
  formatOcrAttemptSummary,
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
      matches: [],
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
      "PaddleOCR.js / Raw high-resolution render / full page: 7 matched, setup 5678ms, OCR 1234ms"
    );

    expect(
      formatOcrAttemptSummary({
        ...baseAttempt,
        tileMode: "tiled",
        tileCount: 4
      })
    ).toBe(
      "PaddleOCR.js / Raw high-resolution render / tiled x4: 7 matched, OCR 1234ms"
    );
  });
});

describe("sortOcrAttemptsByMatches", () => {
  it("orders attempts by matched count, then ambiguity, then duration", () => {
    const attempt = (
      engineId: string,
      matched: number,
      ambiguous: number,
      durationMs: number
    ): OcrAttempt => ({
      engineId,
      engineLabel: engineId,
      durationMs,
      textItems: [],
      candidates: [],
      matches: [],
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
        attempt("faster-tie", 4, 0, 200)
      ]).map((attempt) => attempt.engineId)
    ).toEqual([
      "ambiguous-tie",
      "faster-tie",
      "most-useful",
      "slow-less-useful"
    ]);
  });
});
