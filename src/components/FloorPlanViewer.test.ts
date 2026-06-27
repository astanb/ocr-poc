import { describe, expect, it } from "vitest";
import { getPinPopoverDetails, getPinPopoverPosition } from "./FloorPlanViewer";
import type { RoomMatch } from "../types/matching";

describe("getPinPopoverDetails", () => {
  it("formats the selected room details for the floor-plan popup", () => {
    const match: RoomMatch = {
      roomId: "room-1",
      roomRawName: "GF017 - Disp. Store",
      matchedText: "Disp. St0re GFOI7",
      page: 2,
      confidence: 0.9,
      status: "matched",
      reason: "Exact room-code match."
    };

    expect(getPinPopoverDetails(match)).toEqual({
      room: "GF017 - Disp. Store",
      matchedText: "Disp. St0re GFOI7",
      page: "2",
      confidence: "90%",
      status: "matched",
      reason: "Exact room-code match."
    });
  });

  it("keeps the popup inside the floor-plan stage near the edges", () => {
    expect(getPinPopoverPosition({ x: 0, y: 10 }, 1000, 1000)).toEqual({
      left: 10,
      top: 8,
      placement: "below"
    });

    expect(getPinPopoverPosition({ x: 1000, y: 990 }, 1000, 1000)).toEqual({
      left: 90,
      top: 92,
      placement: "above"
    });
  });
});
