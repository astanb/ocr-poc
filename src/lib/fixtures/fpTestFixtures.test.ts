import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  FLOOR_PLAN_FIXTURES,
  ROOM_LIST_FIXTURES,
  getDefaultRoomListIdForFloorPlan,
  getFixtureById
} from "./fpTestFixtures";

describe("FP test fixtures", () => {
  it("maps split floor-plan fixtures to floor-specific room lists when available", () => {
    expect(getDefaultRoomListIdForFloorPlan("2-GF")).toBe("2-GF");
    expect(getDefaultRoomListIdForFloorPlan("7-1F")).toBe("7-1F");
    expect(getDefaultRoomListIdForFloorPlan("9-FF")).toBe("9-FF");
  });

  it("falls back to a numbered room list when a split floor has no workbook", () => {
    expect(getDefaultRoomListIdForFloorPlan("6-Mez")).toBe("6");
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

  it("points every listed fixture at a bundled file", () => {
    for (const fixture of [...FLOOR_PLAN_FIXTURES, ...ROOM_LIST_FIXTURES]) {
      expect(
        existsSync(join(process.cwd(), "public/fixtures/fp-tests", fixture.fileName)),
        fixture.fileName
      ).toBe(true);
    }
  });
});
