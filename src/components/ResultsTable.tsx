import type { OcrAttempt } from "../lib/ocr/ocrPipeline";
import type { RoomMatch } from "../types/matching";

type Props = {
  matches: RoomMatch[];
  ocrAttempts?: OcrAttempt[];
  selectedRoomId?: string;
  onRoomSelect?: (roomId: string) => void;
  onExport: () => void;
};

export function ResultsTable({
  matches,
  ocrAttempts = [],
  selectedRoomId,
  onRoomSelect,
  onExport
}: Props) {
  const summary = summarizeMatchSources(matches);
  const sortedOcrAttempts = sortOcrAttemptsByMatches(ocrAttempts);

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

      {ocrAttempts.length > 0 && (
        <div className="ocr-attempt-summary" aria-label="OCR engine summary">
          {sortedOcrAttempts.map((attempt) => (
            <span key={getOcrAttemptKey(attempt)}>
              {formatOcrAttemptSummary(attempt)}
            </span>
          ))}
        </div>
      )}

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
                <tr
                  key={match.roomId}
                  className={match.roomId === selectedRoomId ? "result-row-selected" : undefined}
                >
                  <td>
                    {canSelectRoom(match, onRoomSelect) ? (
                      <button
                        type="button"
                        className="room-result-button"
                        onClick={() => onRoomSelect?.(match.roomId)}
                      >
                        {match.roomRawName}
                      </button>
                    ) : (
                      match.roomRawName
                    )}
                  </td>
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

export function sortOcrAttemptsByMatches(attempts: OcrAttempt[]): OcrAttempt[] {
  return attempts
    .slice()
    .sort((left, right) =>
      right.stats.matched - left.stats.matched ||
      right.stats.ambiguous - left.stats.ambiguous ||
      left.durationMs - right.durationMs
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
      } else if (match.matchedSource.startsWith("ocr:")) {
        summary.ocr += 1;
      } else {
        summary.mixed += 1;
      }

      return summary;
    },
    { total: 0, pdfText: 0, ocr: 0, mixed: 0, unmatched: 0 }
  );
}

export function formatOcrAttemptSummary(attempt: OcrAttempt): string {
  const labelParts = [
    attempt.engineLabel,
    attempt.passLabel,
    formatTileMode(attempt)
  ].filter(Boolean);
  const timingParts = [
    attempt.setupDurationMs
      ? `setup ${Math.round(attempt.setupDurationMs)}ms`
      : undefined,
    attempt.errorMessage
      ? attempt.errorMessage
      : `OCR ${Math.round(attempt.durationMs)}ms`
  ].filter(Boolean);

  return `${labelParts.join(" / ")}: ${attempt.stats.matched} matched, ${timingParts.join(", ")}`;
}

function getOcrAttemptKey(attempt: OcrAttempt): string {
  return [
    attempt.engineId,
    attempt.passId ?? "default",
    attempt.tileMode ?? "single",
    attempt.tileCount ?? 0
  ].join("-");
}

function formatTileMode(attempt: OcrAttempt): string | undefined {
  if (attempt.tileMode === "tiled") {
    return `tiled x${attempt.tileCount ?? 0}`;
  }

  if (attempt.tileMode === "full-page") {
    return "full page";
  }

  return undefined;
}

function formatSource(source?: string): string {
  if (!source) {
    return "";
  }

  if (source === "pdf-text") {
    return "PDF text";
  }

  if (source.startsWith("ocr:")) {
    return `${formatEngineName(source.slice("ocr:".length))} OCR`;
  }

  return source;
}

function formatEngineName(engineId: string): string {
  if (engineId === "tesseract") {
    return "Tesseract";
  }

  if (engineId === "paddle") {
    return "Paddle";
  }

  if (engineId === "tesseract-wasm") {
    return "tesseract-wasm";
  }

  return engineId;
}

function formatNumber(value?: number): string {
  return typeof value === "number" ? value.toFixed(1) : "";
}

function canSelectRoom(
  match: RoomMatch,
  onRoomSelect?: (roomId: string) => void
): boolean {
  return Boolean(onRoomSelect) &&
    typeof match.x === "number" &&
    typeof match.y === "number";
}
