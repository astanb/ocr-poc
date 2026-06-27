import { describe, expect, it } from "vitest";
import { calculatePdfRenderScale } from "./renderPdfPage";

describe("calculatePdfRenderScale", () => {
  it("renders ordinary pages at 300 DPI for OCR clarity", () => {
    expect(calculatePdfRenderScale({ width: 800, height: 600 })).toBeCloseTo(
      300 / 72,
      4
    );
  });

  it("caps huge pages to the largest browser-safe canvas scale", () => {
    const scale = calculatePdfRenderScale({
      width: 4_000,
      height: 3_000,
      maxCanvasDimension: 8_192,
      maxCanvasPixels: 36_000_000
    });

    expect(scale).toBeCloseTo(Math.sqrt(36_000_000 / (4_000 * 3_000)), 4);
    expect(4_000 * scale).toBeLessThanOrEqual(8_192);
    expect(4_000 * scale * 3_000 * scale).toBeLessThanOrEqual(36_000_000);
  });
});
