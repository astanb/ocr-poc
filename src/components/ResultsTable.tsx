import type { RoomMatch } from "../types/matching";

type Props = {
  matches: RoomMatch[];
  onExport: () => void;
};

export function ResultsTable({ matches, onExport }: Props) {
  const summary = summarizeMatchSources(matches);

  return (
    <section className="panel results-panel" aria-label="Room match results">
      <div className="panel-title-row">
        <h2>Results</h2>
        <button type="button" disabled={matches.length === 0} onClick={onExport}>
          Export JSON
        </button>
      </div>

      <div className="result-summary" aria-label="Result source summary">
        <span>{summary.total} rooms</span>
        <span>{summary.pdfText} PDF text</span>
        <span>{summary.ocr} OCR</span>
        <span>{summary.mixed} mixed</span>
        <span>{summary.unmatched} unmatched</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Room</th>
              <th>Matched text</th>
              <th>Source</th>
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
                <td colSpan={9}>No results yet</td>
              </tr>
            ) : (
              matches.map((match) => (
                <tr key={match.roomId}>
                  <td>{match.roomRawName}</td>
                  <td>{match.matchedText ?? ""}</td>
                  <td>{formatSource(match.matchedSource)}</td>
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

export function summarizeMatchSources(matches: RoomMatch[]) {
  return matches.reduce(
    (summary, match) => {
      summary.total += 1;

      if (match.status === "unmatched" || !match.matchedSource) {
        summary.unmatched += 1;
      } else if (match.matchedSource === "pdf-text") {
        summary.pdfText += 1;
      } else if (match.matchedSource === "ocr") {
        summary.ocr += 1;
      } else {
        summary.mixed += 1;
      }

      return summary;
    },
    { total: 0, pdfText: 0, ocr: 0, mixed: 0, unmatched: 0 }
  );
}

function formatSource(source?: string): string {
  if (source === "pdf-text") {
    return "PDF text";
  }

  if (source === "ocr") {
    return "OCR";
  }

  return source ?? "";
}

function formatNumber(value?: number): string {
  return typeof value === "number" ? value.toFixed(1) : "";
}
