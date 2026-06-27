import { describe, expect, it } from "vitest";
import type { ExtractedLabelCandidate } from "../../types/floorPlan";
import type { RoomListItem } from "../../types/rooms";
import { matchRooms } from "./matchRooms";

const room = (
  id: string,
  rawName: string,
  normalizedName: string,
  possibleCode?: string
): RoomListItem => ({ id, rawName, normalizedName, possibleCode });

const candidate = (
  id: string,
  rawText: string,
  normalizedText: string,
  x: number,
  source: ExtractedLabelCandidate["source"] = "pdf-text"
): ExtractedLabelCandidate => ({
  id,
  rawText,
  normalizedText,
  page: 1,
  x,
  y: 20,
  width: 80,
  height: 12,
  source,
  childItems: []
});

describe("matchRooms", () => {
  it("matches rooms by unique exact room code with high confidence", () => {
    const matches = matchRooms(
      [room("room-1", "GF004 - General Teaching Area", "gf004 general teaching area", "GF004")],
      [
        candidate("candidate-1", "GF004 General Teaching", "gf004 general teaching", 10),
        candidate("candidate-2", "GF006 Store", "gf006 store", 200)
      ]
    );

    expect(matches[0]).toMatchObject({
      roomId: "room-1",
      matchedCandidateId: "candidate-1",
      matchedText: "GF004 General Teaching",
      matchedSource: "pdf-text",
      confidence: 0.95,
      status: "matched"
    });
  });

  it("records OCR as the source when the selected candidate came from OCR", () => {
    const matches = matchRooms(
      [room("room-1", "GF004 - General Teaching Area", "gf004 general teaching area", "GF004")],
      [candidate("candidate-1", "GF004 General Teaching", "gf004 general teaching", 10, "ocr")]
    );

    expect(matches[0]).toMatchObject({
      matchedCandidateId: "candidate-1",
      matchedSource: "ocr"
    });
    expect(matches[0]?.alternatives?.[0]).toMatchObject({
      source: "ocr"
    });
  });

  it("marks close competing candidates as ambiguous", () => {
    const matches = matchRooms(
      [room("room-1", "S06 Water Treatment", "s06 water treatment", "S06")],
      [
        candidate("candidate-1", "S06 Water Treatment", "s06 water treatment", 10),
        candidate("candidate-2", "S-06 Water", "s 06 water", 180)
      ]
    );

    expect(matches[0]?.status).toBe("ambiguous");
    expect(matches[0]?.alternatives).toHaveLength(2);
  });

  it("does not hallucinate unmatched rooms", () => {
    const matches = matchRooms(
      [room("room-1", "GF999 Missing Room", "gf999 missing room", "GF999")],
      [candidate("candidate-1", "GF004 Teaching", "gf004 teaching", 10)]
    );

    expect(matches[0]).toMatchObject({
      roomId: "room-1",
      confidence: 0,
      status: "unmatched"
    });
  });

  it("uses fuzzy name matching for OCR spelling noise", () => {
    const matches = matchRooms(
      [room("room-1", "GF017 - DISP STORE", "gf017 disp store", "GF017")],
      [candidate("candidate-1", "Disp. St0re GFOI7", "disp st0re gfoi7", 10)]
    );

    expect(matches[0]).toMatchObject({
      matchedCandidateId: "candidate-1",
      status: "matched",
      confidence: 0.95,
      reason: "Exact room-code match with partial room-name support."
    });
  });

  it("does not fuzzy-match a coded room to a candidate with no code", () => {
    const matches = matchRooms(
      [room("room-1", "GF004 - CLASS BASES", "gf004 class bases", "GF004")],
      [candidate("candidate-1", "Early Years Classes", "early years classes", 10)]
    );

    expect(matches[0]).toMatchObject({
      status: "unmatched",
      confidence: 0
    });
  });

  it("does not assign the same candidate to several rooms", () => {
    const matches = matchRooms(
      [
        room("room-2", "GF001A - Circulation", "gf001a circulation", "GF001A"),
        room("room-1", "GF001 - Circulation", "gf001 circulation", "GF001")
      ],
      [candidate("candidate-1", "GF001 Circulation", "gf001 circulation", 10)]
    );

    expect(matches[0]).toMatchObject({
      roomId: "room-2",
      status: "unmatched"
    });
    expect(matches[0]).not.toHaveProperty("matchedCandidateId");
    expect(matches[1]).toMatchObject({
      roomId: "room-1",
      matchedCandidateId: "candidate-1",
      status: "matched"
    });
  });

  it("prefers the duplicate room-code candidate with matching room-name context", () => {
    const matches = matchRooms(
      [room("room-1", "G046 - Teaching Area", "g046 teaching area", "G046")],
      [
        candidate("candidate-1", "Girls WC G046", "girls wc g046", 10),
        candidate("candidate-2", "Teaching Area G046", "teaching area g046", 200)
      ]
    );

    expect(matches[0]).toMatchObject({
      matchedCandidateId: "candidate-2",
      matchedText: "Teaching Area G046",
      confidence: 0.98,
      status: "matched"
    });
  });
});
