import { describe, expect, it } from "vitest";
import {
  FLOOR_PLAN_FIXTURES,
  ROOM_LIST_FIXTURES,
  getDefaultRoomListIdForFloorPlan,
  getFixtureById
} from "./fpTestFixtures";

describe("FP test fixtures", () => {
  it("maps split floor-plan fixtures to their numbered room list", () => {
    expect(getDefaultRoomListIdForFloorPlan("2-GF")).toBe("2");
    expect(getDefaultRoomListIdForFloorPlan("9-FF")).toBe("9");
  });

  it("contains a selectable room list for every floor-plan set", () => {
    const roomListIds = new Set(ROOM_LIST_FIXTURES.map((fixture) => fixture.id));

    expect(
      FLOOR_PLAN_FIXTURES.every((fixture) =>
        roomListIds.has(getDefaultRoomListIdForFloorPlan(fixture.id))
      )
    ).toBe(true);
  });

  it("finds fixtures by id", () => {
    expect(getFixtureById(FLOOR_PLAN_FIXTURES, "7-GF")?.fileName).toBe("7-GF.pdf");
  });
});
