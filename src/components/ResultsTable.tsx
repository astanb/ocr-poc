import type { RoomMatch } from "../types/matching";

type Props = {
  matches: RoomMatch[];
  onExport: () => void;
};

export function ResultsTable({ matches, onExport }: Props) {
  return (
    <section className="panel results-panel" aria-label="Room match results">
      <div className="panel-title-row">
        <h2>Results</h2>
        <button type="button" disabled={matches.length === 0} onClick={onExport}>
          Export JSON
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Room</th>
              <th>Matched text</th>
              <th>Page</th>
              <th>X</th>
              <th>Y</th>
              <th>Confidence</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {matches.length === 0 ? (
              <tr>
                <td colSpan={8}>No results yet</td>
              </tr>
            ) : (
              matches.map((match) => (
                <tr key={match.roomId}>
                  <td>{match.roomRawName}</td>
                  <td>{match.matchedText ?? ""}</td>
                  <td>{match.page ?? ""}</td>
                  <td>{formatNumber(match.x)}</td>
                  <td>{formatNumber(match.y)}</td>
                  <td>{Math.round(match.confidence * 100)}%</td>
                  <td>
                    <span className={`status status-${match.status}`}>{match.status}</span>
                  </td>
                  <td>{match.reason}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatNumber(value?: number): string {
  return typeof value === "number" ? value.toFixed(1) : "";
}
