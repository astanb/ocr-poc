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
  onPinMove: (roomId: string, x: number, y: number) => void;
};

export function FloorPlanViewer({ preview, matches, onPinMove }: Props) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [draggingRoomId, setDraggingRoomId] = useState<string>();
  const [selectedRoomId, setSelectedRoomId] = useState<string>();

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
  const selectedMatch = visibleMatches.find((match) => match.roomId === selectedRoomId);

  function updatePin(roomId: string, clientX: number, clientY: number) {
    if (!stageRef.current || !preview) {
      return;
    }

    const bounds = stageRef.current.getBoundingClientRect();
    const xPercent = clamp((clientX - bounds.left) / bounds.width, 0, 1);
    const yPercent = clamp((clientY - bounds.top) / bounds.height, 0, 1);
    onPinMove(roomId, xPercent * preview.width, yPercent * preview.height);
  }

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
        onPointerMove={(event) => {
          if (draggingRoomId) {
            updatePin(draggingRoomId, event.clientX, event.clientY);
          }
        }}
        onPointerUp={() => setDraggingRoomId(undefined)}
        onPointerCancel={() => setDraggingRoomId(undefined)}
      >
        {!preview && <div className="empty-state">No floor plan rendered yet</div>}
        {preview?.kind === "image" && (
          <img className="floor-plan-media" src={preview.url} alt="Uploaded floor plan" />
        )}
        {preview?.kind === "canvas" && <div ref={canvasHostRef} />}

        {preview &&
          visibleMatches.map((match) => (
            <button
              key={match.roomId}
              type="button"
              className={`pin pin-${match.status}`}
              style={{
                left: `${((match.x ?? 0) / preview.width) * 100}%`,
                top: `${((match.y ?? 0) / preview.height) * 100}%`
              }}
              title={`${match.roomRawName}\n${match.matchedText ?? "No matched text"}\n${Math.round(
                match.confidence * 100
              )}%`}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDraggingRoomId(match.roomId);
              }}
              onClick={() => {
                setSelectedRoomId(match.roomId);
              }}
            >
              <span>{Math.round(match.confidence * 100)}</span>
            </button>
          ))}

        {preview && selectedMatch && (
          <PinPopover
            match={selectedMatch}
            previewWidth={preview.width}
            previewHeight={preview.height}
            onClose={() => setSelectedRoomId(undefined)}
          />
        )}
      </div>
    </section>
  );
}

function PinPopover({
  match,
  previewWidth,
  previewHeight,
  onClose
}: {
  match: RoomMatch;
  previewWidth: number;
  previewHeight: number;
  onClose: () => void;
}) {
  const details = getPinPopoverDetails(match);
  const position = getPinPopoverPosition(match, previewWidth, previewHeight);

  return (
    <aside
      className={`pin-popover pin-popover-${position.placement}`}
      style={{
        left: `${position.left}%`,
        top: `${position.top}%`
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
