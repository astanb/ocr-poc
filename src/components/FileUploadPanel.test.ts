import { describe, expect, it } from "vitest";
import {
  getDisplayedProcessingSteps,
  getProgressScrollTop,
  getSpreadsheetStatus
} from "./FileUploadPanel";

describe("getSpreadsheetStatus", () => {
  it("reports detected rooms when the spreadsheet has parsed", () => {
    expect(
      getSpreadsheetStatus({
        rooms: [
          {
            id: "room-1",
            rawName: "GF001 - Store",
            normalizedName: "gf001 store",
            possibleCode: "GF001"
          }
        ],
        columns: ["Room Name"],
        selectedColumn: "Room Name",
        confidence: 1
      })
    ).toEqual({
      kind: "ready",
      text: "1 rooms detected"
    });
  });

  it("surfaces spreadsheet parsing failures instead of waiting forever", () => {
    expect(getSpreadsheetStatus(undefined, "Could not read workbook")).toEqual({
      kind: "error",
      text: "Spreadsheet error: Could not read workbook"
    });
  });

  it("keeps the full processing history available for scrolling", () => {
    const steps = Array.from({ length: 12 }, (_, index) => ({
      engineId: "engine",
      engineLabel: "Engine",
      status: "completed" as const,
      message: `step ${index + 1}`
    }));

    expect(getDisplayedProcessingSteps(steps).map((step) => step.message)).toEqual([
      "step 1",
      "step 2",
      "step 3",
      "step 4",
      "step 5",
      "step 6",
      "step 7",
      "step 8",
      "step 9",
      "step 10",
      "step 11",
      "step 12"
    ]);
  });
});

describe("getProgressScrollTop", () => {
  it("keeps the live processing panel pinned to the latest step", () => {
    expect(getProgressScrollTop({ scrollHeight: 1840 })).toBe(1840);
  });
});
