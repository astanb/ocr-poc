import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOcrPassInputs } from "./App";

describe("createOcrPassInputs", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray([255, 255, 255, 255]),
        width: 1,
        height: 1,
        colorSpace: "srgb"
      })),
      putImageData: vi.fn()
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to raw high-resolution tiled OCR only", () => {
    const inputs = createOcrPassInputs(createCanvas());

    expect(inputs.map((input) => input.id)).toEqual(["raw"]);
    expect(inputs[0]).toMatchObject({
      label: "Raw high-resolution render",
      runFullPage: false
    });
    expect(inputs[0].tiledImages?.length).toBeGreaterThan(1);
  });

  it("can re-enable extra preprocessing passes and full-page OCR", () => {
    const inputs = createOcrPassInputs(createCanvas(), {
      passIds: ["raw", "threshold"],
      modes: ["full-page"]
    });

    expect(inputs.map((input) => input.id)).toEqual(["raw", "threshold"]);
    expect(inputs.every((input) => input.runFullPage)).toBe(true);
    expect(inputs.every((input) => input.tiledImages === undefined)).toBe(true);
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 2500;
  canvas.height = 1000;
  return canvas;
}
