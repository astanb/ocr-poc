import { useEffect, useRef, useState } from "react";
import type { RoomMatch } from "../types/matching";

type Preview =
  | {
      kind: "canvas";
      canvas: HTMLCanvasElement;
      width: number;
      height: number;
    }
  | {
      kind: "image";
      url: string;
      width: number;
      height: number;
    };

type Props = {
  preview?: Preview;
  matches: RoomMatch[];
  selectedRoomId?: string;
  onRoomSelect?: (roomId: string | undefined) => void;
  onPinMove?: (roomId: string, x: number, y: number) => void;
};

type ViewTransform = {
  scale: number;
  panX: number;
  panY: number;
};

type PanDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const FOCUS_ZOOM = 2;
const ZOOM_STEP = 1.18;

export function FloorPlanViewer({
  preview,
  matches,
  selectedRoomId,
  onRoomSelect
}: Props) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [internalSelectedRoomId, setInternalSelectedRoomId] = useState<string>();
  const [viewTransform, setViewTransform] = useState<ViewTransform>({
    scale: 1,
    panX: 0,
    panY: 0
  });
  const [panDrag, setPanDrag] = useState<PanDrag>();
  const [isAnimatingToSelection, setIsAnimatingToSelection] = useState(false);
  const previewRef = useRef(preview);
  const viewTransformRef = useRef(viewTransform);

  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  useEffect(() => {
    viewTransformRef.current = viewTransform;
  }, [viewTransform]);

  useEffect(() => {
    if (!canvasHostRef.current || preview?.kind !== "canvas") {
      return;
    }

    const host = canvasHostRef.current;
    host.replaceChildren(preview.canvas);
    preview.canvas.className = "floor-plan-media";
  }, [preview]);

  useEffect(() => {
    const currentStage = stageRef.current;
    if (!currentStage) {
      return;
    }
    const stageElement = currentStage;

    function handleWheel(event: WheelEvent) {
      if (!previewRef.current) {
        return;
      }

      event.preventDefault();
      const bounds = stageElement.getBoundingClientRect();
      setIsAnimatingToSelection(false);
      setViewTransform(
        getWheelZoomTransform({
          current: viewTransformRef.current,
          deltaY: event.deltaY,
          originX: event.clientX - bounds.left,
          originY: event.clientY - bounds.top,
          viewportWidth: bounds.width,
          viewportHeight: bounds.height
        })
      );
    }

    stageElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => stageElement.removeEventListener("wheel", handleWheel);
  }, []);

  const visibleMatches = matches.filter(
    (match) => typeof match.x === "number" && typeof match.y === "number"
      && (match.page ?? 1) === 1
  );
  const activeSelectedRoomId = selectedRoomId ?? internalSelectedRoomId;
  const selectedMatch = visibleMatches.find((match) => match.roomId === activeSelectedRoomId);

  useEffect(() => {
    setViewTransform({ scale: 1, panX: 0, panY: 0 });
    setPanDrag(undefined);
    setIsAnimatingToSelection(false);
  }, [preview]);

  useEffect(() => {
    if (!selectedMatch || !preview || !stageRef.current) {
      return;
    }

    const bounds = stageRef.current.getBoundingClientRect();
    setIsAnimatingToSelection(true);
    setViewTransform((current) =>
      constrainViewTransform({
        transform: getCenteredViewTransform({
          currentScale: getSelectionFocusScale(current.scale),
          previewWidth: preview.width,
          previewHeight: preview.height,
          viewportWidth: bounds.width,
          viewportHeight: bounds.height,
          x: selectedMatch.x ?? 0,
          y: selectedMatch.y ?? 0
        }),
        viewportWidth: bounds.width,
        viewportHeight: bounds.height
      })
    );
  }, [preview, selectedMatch]);

  const inverseScale = 1 / viewTransform.scale;

  return (
    <section className="panel viewer-panel" aria-label="Floor plan viewer">
      <div className="panel-title-row">
        <h2>Floor Plan</h2>
        <span>{visibleMatches.length} pins</span>
      </div>

      <div
        ref={stageRef}
        className="floor-plan-stage"
        style={{ aspectRatio: preview ? `${preview.width} / ${preview.height}` : "16 / 10" }}
        onPointerDown={(event) => {
          if (!preview || event.button !== 0 || isInteractivePlanTarget(event.target)) {
            return;
          }

          event.currentTarget.setPointerCapture(event.pointerId);
          setIsAnimatingToSelection(false);
          setPanDrag({
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startPanX: viewTransform.panX,
            startPanY: viewTransform.panY
          });
        }}
        onPointerMove={(event) => {
          if (!panDrag || panDrag.pointerId !== event.pointerId) {
            return;
          }

          const bounds = event.currentTarget.getBoundingClientRect();
          setViewTransform((current) =>
            constrainViewTransform({
              transform: {
                ...current,
                panX: panDrag.startPanX + event.clientX - panDrag.startX,
                panY: panDrag.startPanY + event.clientY - panDrag.startY
              },
              viewportWidth: bounds.width,
              viewportHeight: bounds.height
            })
          );
        }}
        onPointerUp={() => setPanDrag(undefined)}
        onPointerCancel={() => setPanDrag(undefined)}
      >
        {!preview && <div className="empty-state">No floor plan rendered yet</div>}
        {preview && (
          <div
            className={`floor-plan-content${isAnimatingToSelection ? " floor-plan-content-animated" : ""}`}
            style={{
              transform: `translate(${viewTransform.panX}px, ${viewTransform.panY}px) scale(${viewTransform.scale})`
            }}
            onTransitionEnd={() => setIsAnimatingToSelection(false)}
          >
            {preview.kind === "image" && (
              <img className="floor-plan-media" src={preview.url} alt="Uploaded floor plan" />
            )}
            {preview.kind === "canvas" && <div ref={canvasHostRef} />}

            {visibleMatches
              .filter((match) => match.roomId !== activeSelectedRoomId)
              .map((match) => (
                <button
                  key={match.roomId}
                  type="button"
                  className={`pin pin-${match.status}`}
                  style={{
                    left: `${((match.x ?? 0) / preview.width) * 100}%`,
                    top: `${((match.y ?? 0) / preview.height) * 100}%`,
                    transform: `translate(-50%, -50%) scale(${inverseScale})`
                  }}
                  title={`${match.roomRawName}\n${match.matchedText ?? "No matched text"}\n${Math.round(
                    match.confidence * 100
                  )}%`}
                  onClick={() => {
                    selectRoom(match.roomId);
                  }}
                >
                  <span>{Math.round(match.confidence * 100)}</span>
                </button>
              ))}

            {selectedMatch && (
              <PinPopover
                match={selectedMatch}
                previewWidth={preview.width}
                previewHeight={preview.height}
                inverseScale={inverseScale}
                onClose={() => selectRoom(undefined)}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );

  function selectRoom(roomId: string | undefined) {
    setInternalSelectedRoomId(roomId);
    onRoomSelect?.(roomId);
  }
}

function PinPopover({
  match,
  previewWidth,
  previewHeight,
  inverseScale,
  onClose
}: {
  match: RoomMatch;
  previewWidth: number;
  previewHeight: number;
  inverseScale: number;
  onClose: () => void;
}) {
  const details = getPinPopoverDetails(match);
  const position = getPinPopoverPosition(match, previewWidth, previewHeight);

  return (
    <aside
      className={`pin-popover pin-popover-${position.placement}`}
      style={{
        left: `${position.left}%`,
        top: `${position.top}%`,
        transform: getPinPopoverTransform(position.placement, inverseScale)
      }}
      aria-label={`Details for ${details.room}`}
    >
      <div className="pin-popover-header">
        <strong>{details.room}</strong>
        <button type="button" className="pin-popover-close" onClick={onClose} aria-label="Close">
          x
        </button>
      </div>
      <dl>
        <div>
          <dt>Matched text</dt>
          <dd>{details.matchedText}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{details.status}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{details.confidence}</dd>
        </div>
        <div>
          <dt>Page</dt>
          <dd>{details.page}</dd>
        </div>
      </dl>
      <p>{details.reason}</p>
    </aside>
  );
}

export function getPinPopoverDetails(match: RoomMatch) {
  return {
    room: match.roomRawName,
    matchedText: match.matchedText ?? "No matched text",
    page: String(match.page ?? 1),
    confidence: `${Math.round(match.confidence * 100)}%`,
    status: match.status,
    reason: match.reason
  };
}

export function getPinPopoverPosition(
  match: Pick<RoomMatch, "x" | "y">,
  previewWidth: number,
  previewHeight: number
) {
  const left = clamp(((match.x ?? 0) / previewWidth) * 100, 10, 90);
  const top = ((match.y ?? 0) / previewHeight) * 100;
  const placement = top < 28 ? "below" : "above";

  return {
    left,
    top: clamp(top, 8, 92),
    placement
  };
}

export function getCenteredViewTransform({
  currentScale,
  previewWidth,
  previewHeight,
  viewportWidth,
  viewportHeight,
  x,
  y
}: {
  currentScale: number;
  previewWidth: number;
  previewHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  x: number;
  y: number;
}): ViewTransform {
  const renderedX = (x / previewWidth) * viewportWidth;
  const renderedY = (y / previewHeight) * viewportHeight;

  return {
    scale: currentScale,
    panX: viewportWidth / 2 - renderedX * currentScale,
    panY: viewportHeight / 2 - renderedY * currentScale
  };
}

export function zoomViewTransform({
  current,
  nextScale,
  originX,
  originY
}: {
  current: ViewTransform;
  nextScale: number;
  originX: number;
  originY: number;
}): ViewTransform {
  const contentX = (originX - current.panX) / current.scale;
  const contentY = (originY - current.panY) / current.scale;

  return {
    scale: nextScale,
    panX: originX - contentX * nextScale,
    panY: originY - contentY * nextScale
  };
}

export function getWheelZoomTransform({
  current,
  deltaY,
  originX,
  originY,
  viewportWidth,
  viewportHeight
}: {
  current: ViewTransform;
  deltaY: number;
  originX: number;
  originY: number;
  viewportWidth: number;
  viewportHeight: number;
}): ViewTransform {
  const nextScale = clamp(
    current.scale * (deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP),
    MIN_ZOOM,
    MAX_ZOOM
  );

  return constrainViewTransform({
    transform: zoomViewTransform({
      current,
      nextScale,
      originX,
      originY
    }),
    viewportWidth,
    viewportHeight
  });
}

export function constrainViewTransform({
  transform,
  viewportWidth,
  viewportHeight
}: {
  transform: ViewTransform;
  viewportWidth: number;
  viewportHeight: number;
}): ViewTransform {
  const minPanX = viewportWidth - viewportWidth * transform.scale;
  const minPanY = viewportHeight - viewportHeight * transform.scale;

  return {
    scale: transform.scale,
    panX: clamp(transform.panX, minPanX, 0),
    panY: clamp(transform.panY, minPanY, 0)
  };
}

export function getSelectionFocusScale(currentScale: number): number {
  return Math.max(currentScale, FOCUS_ZOOM);
}

function getPinPopoverTransform(
  placement: ReturnType<typeof getPinPopoverPosition>["placement"],
  inverseScale: number
): string {
  const yOffset = placement === "below" ? "22px" : "calc(-100% - 22px)";
  return `translate(-50%, ${yOffset}) scale(${inverseScale})`;
}

function isInteractivePlanTarget(target: EventTarget): boolean {
  return target instanceof Element && Boolean(target.closest("button, .pin-popover"));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
