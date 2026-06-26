import { describe, expect, it } from "vitest";
import { extractRoomCode, normalizeRoomCode, normalizeText } from "./normalize";

describe("normalization", () => {
  it("normalizes text for deterministic comparison", () => {
    expect(normalizeText("  GF004 - GENERAL   TEACHING AREA ")).toBe(
      "gf004 general teaching area"
    );
  });

  it("normalizes equivalent room-code formats", () => {
    expect(normalizeRoomCode("GF004")).toBe("GF004");
    expect(normalizeRoomCode("GF-004")).toBe("GF004");
    expect(normalizeRoomCode("G.F.004")).toBe("GF004");
    expect(normalizeRoomCode("G 004")).toBe("G004");
  });

  it("extracts likely room codes from common room labels", () => {
    expect(extractRoomCode("Room GF004 - General Teaching Area")).toBe("GF004");
    expect(extractRoomCode("S-06 Water Treatment Area")).toBe("S06");
    expect(extractRoomCode("G.004")).toBe("G004");
  });
});
