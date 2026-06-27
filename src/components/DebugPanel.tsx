import type { ExtractedLabelCandidate, ExtractedTextItem } from "../types/floorPlan";
import type { RoomMatch } from "../types/matching";
import type { RoomListItem } from "../types/rooms";

type Props = {
  message: string;
  processingDurationMs?: number;
  textItems: ExtractedTextItem[];
  candidates: ExtractedLabelCandidate[];
  matches: RoomMatch[];
  rooms: RoomListItem[];
  errorDetails: string;
};

export function DebugPanel({
  message,
  processingDurationMs,
  textItems,
  candidates,
  matches,
  rooms,
  errorDetails
}: Props) {
  return (
    <aside className="debug-panel" aria-label="Debug panel">
      <h2>Debug</h2>
      <p className="debug-message">{message}</p>
      {processingDurationMs !== undefined && (
        <p className="debug-message">
          Total processing time: {formatProcessingDuration(processingDurationMs)}
        </p>
      )}

      {errorDetails && (
        <section className="error-trace" aria-label="Latest error trace">
          <h3>Latest Error Trace</h3>
          <textarea readOnly value={errorDetails} />
        </section>
      )}

      <DebugBlock title="Rooms" value={rooms} />
      <DebugBlock title="Extracted Text Items" value={textItems} />
      <DebugBlock title="Grouped Label Candidates" value={candidates} />
      <DebugBlock title="Match Results" value={matches} />
    </aside>
  );
}

export function formatProcessingDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

function DebugBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <details>
      <summary>{title}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
