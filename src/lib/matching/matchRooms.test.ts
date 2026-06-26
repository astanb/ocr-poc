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
  x: number
): ExtractedLabelCandidate => ({
  id,
  rawText,
  normalizedText,
  page: 1,
  x,
  y: 20,
  width: 80,
  height: 12,
  source: "pdf-text",
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
      confidence: 0.95,
      status: "matched"
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
});
