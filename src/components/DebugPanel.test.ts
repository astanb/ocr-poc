import { describe, expect, it } from "vitest";
import { formatProcessingDuration } from "./DebugPanel";

describe("formatProcessingDuration", () => {
  it("formats total processing time for the debug panel", () => {
    expect(formatProcessingDuration(842)).toBe("842ms");
    expect(formatProcessingDuration(54_321)).toBe("54.3s");
  });
});
