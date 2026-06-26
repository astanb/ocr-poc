import type { ParsedRoomList } from "../types/rooms";

type Props = {
  floorPlanFile?: File;
  excelFile?: File;
  parsedRoomList?: ParsedRoomList;
  selectedColumn: string;
  shouldConfirmColumn: boolean;
  isProcessing: boolean;
  onFloorPlanChange: (file?: File) => void;
  onExcelChange: (file?: File) => void;
  onColumnChange: (column: string) => void;
  onProcess: () => void;
};

export function FileUploadPanel({
  floorPlanFile,
  excelFile,
  parsedRoomList,
  selectedColumn,
  shouldConfirmColumn,
  isProcessing,
  onFloorPlanChange,
  onExcelChange,
  onColumnChange,
  onProcess
}: Props) {
  const canProcess = Boolean(floorPlanFile && excelFile && parsedRoomList);

  return (
    <section className="panel upload-panel" aria-label="Upload files">
      <div className="panel-heading">
        <h1>OCR Floor Plan Room Matching</h1>
        <p>Browser-only prototype for matching Excel rooms to floor-plan labels.</p>
      </div>

      <div className="upload-grid">
        <label className="field">
          <span>Floor plan</span>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            onChange={(event) => onFloorPlanChange(event.target.files?.[0])}
          />
        </label>

        <label className="field">
          <span>Room list</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => onExcelChange(event.target.files?.[0])}
          />
        </label>
      </div>

      {parsedRoomList && (
        <label className="field compact-field">
          <span>
            Room-name column
            {shouldConfirmColumn ? " requires confirmation" : ""}
          </span>
          <select
            value={selectedColumn}
            onChange={(event) => onColumnChange(event.target.value)}
          >
            {parsedRoomList.columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="upload-actions">
        <button type="button" disabled={!canProcess || isProcessing} onClick={onProcess}>
          {isProcessing ? "Processing..." : "Process"}
        </button>
        <span>
          {parsedRoomList
            ? `${parsedRoomList.rooms.length} rooms detected`
            : "Waiting for spreadsheet"}
        </span>
      </div>
    </section>
  );
}
