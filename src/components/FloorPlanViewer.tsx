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
  const [activeRoomId, setActiveRoomId] = useState<string>();

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
          if (activeRoomId) {
            updatePin(activeRoomId, event.clientX, event.clientY);
          }
        }}
        onPointerUp={() => setActiveRoomId(undefined)}
        onPointerCancel={() => setActiveRoomId(undefined)}
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
                setActiveRoomId(match.roomId);
              }}
            >
              <span>{Math.round(match.confidence * 100)}</span>
            </button>
          ))}
      </div>
    </section>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
