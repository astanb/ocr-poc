import { describe, expect, it } from "vitest";
import { formatErrorDetails, getErrorMessage } from "./formatErrorDetails";

describe("formatErrorDetails", () => {
  it("includes the context, message, and stack", () => {
    const error = new Error("PDF failed");
    error.stack = "Error: PDF failed\n    at renderPdfPage";

    expect(formatErrorDetails(error, "Processing error")).toContain(
      "Processing error: PDF failed\n\nError: PDF failed\n    at renderPdfPage"
    );
  });
});

describe("getErrorMessage", () => {
  it("handles non-Error thrown values", () => {
    expect(getErrorMessage("bad zip")).toBe("bad zip");
    expect(getErrorMessage({ code: "bad_pdf" })).toBe("{\"code\":\"bad_pdf\"}");
  });
});
