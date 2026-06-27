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

  useEffect(() => {
    if (!canvasHostRef.current || preview?.kind !== "canvas") {
      return;
    }

    const host = canvasHostRef.current;
    host.replaceChildren(preview.canvas);
    preview.canvas.className = "floor-plan-media";
  }, [preview]);

  const visibleMatches = matches.filter(
    (match) => typeof match.x === "number" && typeof match.y === "number"
      && (match.page ?? 1) === 1
  );
  const activeSelectedRoomId = selectedRoomId ?? internalSelectedRoomId;
  const selectedMatch = visibleMatches.find((match) => match.roomId === activeSelectedRoomId);

  useEffect(() => {
    setViewTransform({ scale: 1, panX: 0, panY: 0 });
    setPanDrag(undefined);
  }, [preview]);

  useEffect(() => {
    if (!selectedMatch || !preview || !stageRef.current) {
      return;
    }

    const bounds = stageRef.current.getBoundingClientRect();
    setViewTransform((current) =>
      getCenteredViewTransform({
        currentScale: Math.max(current.scale, 2),
        previewWidth: preview.width,
        previewHeight: preview.height,
        viewportWidth: bounds.width,
        viewportHeight: bounds.height,
        x: selectedMatch.x ?? 0,
        y: selectedMatch.y ?? 0
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
        onWheel={(event) => {
          if (!preview) {
            return;
          }

          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          const nextScale = clamp(
            viewTransform.scale * (event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP),
            MIN_ZOOM,
            MAX_ZOOM
          );
          setViewTransform((current) =>
            zoomViewTransform({
              current,
              nextScale,
              originX: event.clientX - bounds.left,
              originY: event.clientY - bounds.top
            })
          );
        }}
        onPointerDown={(event) => {
          if (!preview || event.button !== 0 || isInteractivePlanTarget(event.target)) {
            return;
          }

          event.currentTarget.setPointerCapture(event.pointerId);
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

          setViewTransform((current) => ({
            ...current,
            panX: panDrag.startPanX + event.clientX - panDrag.startX,
            panY: panDrag.startPanY + event.clientY - panDrag.startY
          }));
        }}
        onPointerUp={() => setPanDrag(undefined)}
        onPointerCancel={() => setPanDrag(undefined)}
      >
        {!preview && <div className="empty-state">No floor plan rendered yet</div>}
        {preview && (
          <div
            className="floor-plan-content"
            style={{
              transform: `translate(${viewTransform.panX}px, ${viewTransform.panY}px) scale(${viewTransform.scale})`
            }}
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
