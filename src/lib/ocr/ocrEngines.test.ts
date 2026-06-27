import { describe, expect, it } from "vitest";
import { shouldSkipPaddleOcr } from "./ocrEngines";

describe("shouldSkipPaddleOcr", () => {
  it("skips PaddleOCR on iPhone Safari to avoid tab reloads from memory pressure", () => {
    expect(
      shouldSkipPaddleOcr({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        platform: "iPhone",
        maxTouchPoints: 5
      })
    ).toBe(true);
  });

  it("skips PaddleOCR on touch iPads that report a desktop Mac platform", () => {
    expect(
      shouldSkipPaddleOcr({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5
      })
    ).toBe(true);
  });

  it("allows PaddleOCR on desktop Chromium", () => {
    expect(
      shouldSkipPaddleOcr({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        platform: "MacIntel",
        maxTouchPoints: 0,
        deviceMemory: 8
      })
    ).toBe(false);
  });
});
