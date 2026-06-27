import { describe, expect, it } from "vitest";
import { getSpreadsheetStatus } from "./FileUploadPanel";

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
});
