import { describe, expect, it } from "vitest";
import { extractRoomCode, extractRoomCodes, normalizeRoomCode, normalizeText } from "./normalize";

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
    expect(normalizeRoomCode("GFO40")).toBe("GF040");
    expect(normalizeRoomCode("GFOO1J")).toBe("GF001J");
    expect(normalizeRoomCode("GFOI7")).toBe("GF017");
  });

  it("extracts likely room codes from common room labels", () => {
    expect(extractRoomCode("Room GF004 - General Teaching Area")).toBe("GF004");
    expect(extractRoomCode("S-06 Water Treatment Area")).toBe("S06");
    expect(extractRoomCode("G.004")).toBe("G004");
    expect(extractRoomCode("Play room GFO40")).toBe("GF040");
    expect(extractRoomCode("Disp. St0re GFOI7")).toBe("GF017");
  });

  it("does not treat area measurements as room codes", () => {
    expect(extractRoomCodes("Hub 7.9m2")).toEqual([]);
    expect(extractRoomCodes("Repro 3.4m2 GF047A")).toEqual(["GF047A"]);
  });
});
