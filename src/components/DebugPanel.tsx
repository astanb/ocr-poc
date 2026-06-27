import type { ExtractedLabelCandidate, ExtractedTextItem } from "../types/floorPlan";
import type { RoomMatch } from "../types/matching";
import type { RoomListItem } from "../types/rooms";

type Props = {
  message: string;
  textItems: ExtractedTextItem[];
  candidates: ExtractedLabelCandidate[];
  matches: RoomMatch[];
  rooms: RoomListItem[];
  errorDetails: string;
};

export function DebugPanel({
  message,
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

function DebugBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <details>
      <summary>{title}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
