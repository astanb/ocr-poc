import { describe, expect, it } from "vitest";
import {
  applyOcrPreprocessingToImageData
} from "./ocrPreprocessing";

describe("applyOcrPreprocessingToImageData", () => {
  it("applies grayscale, threshold, and inverted OCR preprocessing transforms", () => {
    const grayscale = makeImageData();
    applyOcrPreprocessingToImageData(grayscale, "grayscale-contrast");

    expect(grayscale.data[0]).toBe(grayscale.data[1]);
    expect(grayscale.data[1]).toBe(grayscale.data[2]);

    const threshold = makeImageData();
    applyOcrPreprocessingToImageData(threshold, "threshold");

    expect(Array.from(threshold.data.slice(0, 3))).toEqual([0, 0, 0]);
    expect(Array.from(threshold.data.slice(4, 7))).toEqual([255, 255, 255]);

    const inverted = makeImageData();
    applyOcrPreprocessingToImageData(inverted, "inverted");

    expect(Array.from(inverted.data.slice(0, 3))).toEqual([255, 255, 255]);
    expect(Array.from(inverted.data.slice(4, 7))).toEqual([0, 0, 0]);
  });
});

function makeImageData(): ImageData {
  return {
    data: new Uint8ClampedArray([
      40, 80, 120, 255,
      220, 220, 220, 255
    ]),
    width: 2,
    height: 1,
    colorSpace: "srgb"
  } as ImageData;
}
