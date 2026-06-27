import { describe, expect, it } from "vitest";
import {
  constrainViewTransform,
  getCenteredViewTransform,
  getPinchZoomTransform,
  getPinPopoverDetails,
  getPinPopoverPosition,
  getScreenPoint,
  getSelectionFocusScale,
  getTouchPanTransform,
  getWheelZoomTransform,
  zoomViewTransform
} from "./FloorPlanViewer";
import type { RoomMatch } from "../types/matching";

describe("getPinPopoverDetails", () => {
  it("formats the selected room details for the floor-plan popup", () => {
    const match: RoomMatch = {
      roomId: "room-1",
      roomRawName: "GF017 - Disp. Store",
      matchedText: "Disp. St0re GFOI7",
      matchedSource: "ocr:paddle",
      page: 2,
      confidence: 0.9,
      status: "matched",
      reason: "Exact room-code match."
    };

    expect(getPinPopoverDetails(match)).toEqual({
      room: "GF017 - Disp. Store",
      matchedText: "Disp. St0re GFOI7",
      source: "Paddle OCR",
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

  it("projects floor-plan coordinates into the unscaled overlay", () => {
    expect(
      getScreenPoint({
        x: 500,
        y: 250,
        previewWidth: 1000,
        previewHeight: 500,
        viewportWidth: 800,
        viewportHeight: 400,
        transform: { scale: 2, panX: -100, panY: -50 }
      })
    ).toEqual({
      x: 700,
      y: 350
    });
  });
});

describe("floor plan view transforms", () => {
  it("centres the viewport on a selected floor-plan coordinate", () => {
    expect(
      getCenteredViewTransform({
        currentScale: 2,
        previewWidth: 2000,
        previewHeight: 1000,
        viewportWidth: 1000,
        viewportHeight: 500,
        x: 1500,
        y: 250
      })
    ).toEqual({
      scale: 2,
      panX: -1000,
      panY: 0
    });
  });

  it("zooms around the pointer so the inspected point stays under the cursor", () => {
    expect(
      zoomViewTransform({
        current: { scale: 2, panX: -100, panY: -50 },
        nextScale: 3,
        originX: 300,
        originY: 200
      })
    ).toEqual({
      scale: 3,
      panX: -300,
      panY: -175
    });
  });

  it("constrains wheel zoom around the pointer", () => {
    expect(
      getWheelZoomTransform({
        current: { scale: 1, panX: 0, panY: 0 },
        deltaY: -1,
        originX: 500,
        originY: 250,
        viewportWidth: 1000,
        viewportHeight: 500
      })
    ).toEqual({
      scale: 1.18,
      panX: -90,
      panY: -45
    });
  });

  it("constrains panning so the floor plan stays against the viewport edges", () => {
    expect(
      constrainViewTransform({
        transform: { scale: 2, panX: 200, panY: -700 },
        viewportWidth: 1000,
        viewportHeight: 500
      })
    ).toEqual({
      scale: 2,
      panX: 0,
      panY: -500
    });
  });

  it("pans from a one-finger touch gesture", () => {
    expect(
      getTouchPanTransform({
        current: { scale: 2, panX: -200, panY: -100 },
        startPanX: -200,
        startPanY: -100,
        deltaX: 40,
        deltaY: -30,
        viewportWidth: 1000,
        viewportHeight: 500
      })
    ).toEqual({
      scale: 2,
      panX: -160,
      panY: -130
    });
  });

  it("pinch-zooms around the touch midpoint", () => {
    expect(
      getPinchZoomTransform({
        startTransform: { scale: 1, panX: 0, panY: 0 },
        scaleRatio: 1.5,
        originX: 500,
        originY: 250,
        viewportWidth: 1000,
        viewportHeight: 500
      })
    ).toEqual({
      scale: 1.5,
      panX: -250,
      panY: -125
    });
  });

  it("keeps the existing zoom level when selecting a pin past the focus zoom", () => {
    expect(getSelectionFocusScale(1)).toBe(2);
    expect(getSelectionFocusScale(3.5)).toBe(3.5);
  });
});
