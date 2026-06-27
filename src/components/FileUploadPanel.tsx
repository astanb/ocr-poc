import { useEffect, useRef } from "react";
import type { ParsedRoomList } from "../types/rooms";
import type { FixtureFile } from "../lib/fixtures/fpTestFixtures";
import type { OcrStrategyId } from "../lib/ocr/ocrEngines";
import type { OcrPipelineProgress } from "../lib/ocr/ocrPipeline";
import type {
  OcrPreprocessingPass,
  OcrPreprocessingPassId
} from "../lib/ocr/ocrPreprocessing";

type OcrRunMode = "full-page" | "tiled";

type Props = {
  floorPlanFixtures: FixtureFile[];
  roomListFixtures: FixtureFile[];
  selectedFloorPlanId: string;
  selectedRoomListId: string;
  selectedOcrStrategyId: OcrStrategyId;
  ocrStrategies: Array<{
    id: OcrStrategyId;
    label: string;
    description: string;
  }>;
  ocrPasses: OcrPreprocessingPass[];
  selectedOcrPassIds: OcrPreprocessingPassId[];
  selectedOcrModes: OcrRunMode[];
  floorPlanFile?: File;
  excelFile?: File;
  parsedRoomList?: ParsedRoomList;
  spreadsheetError?: string;
  selectedColumn: string;
  shouldConfirmColumn: boolean;
  isProcessing: boolean;
  processingSteps: OcrPipelineProgress[];
  onFloorPlanFixtureChange: (fixtureId: string) => void;
  onRoomListFixtureChange: (fixtureId: string) => void;
  onOcrStrategyChange: (strategyId: OcrStrategyId) => void;
  onOcrPassToggle: (passId: OcrPreprocessingPassId) => void;
  onOcrModeToggle: (mode: OcrRunMode) => void;
  onColumnChange: (column: string) => void;
  onProcess: () => void;
};

export function FileUploadPanel({
  floorPlanFixtures,
  roomListFixtures,
  selectedFloorPlanId,
  selectedRoomListId,
  selectedOcrStrategyId,
  ocrStrategies,
  ocrPasses,
  selectedOcrPassIds,
  selectedOcrModes,
  floorPlanFile,
  excelFile,
  parsedRoomList,
  spreadsheetError,
  selectedColumn,
  shouldConfirmColumn,
  isProcessing,
  processingSteps,
  onFloorPlanFixtureChange,
  onRoomListFixtureChange,
  onOcrStrategyChange,
  onOcrPassToggle,
  onOcrModeToggle,
  onColumnChange,
  onProcess
}: Props) {
  const canProcess = Boolean(floorPlanFile && excelFile && parsedRoomList);
  const spreadsheetStatus = getSpreadsheetStatus(parsedRoomList, spreadsheetError);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!progressRef.current) {
      return;
    }

    progressRef.current.scrollTop = getProgressScrollTop({
      scrollHeight: progressRef.current.scrollHeight
    });
  }, [processingSteps]);

  return (
    <section className="panel upload-panel" aria-label="Upload files">
      <div className="panel-heading">
        <h1>OCR Floor Plan Room Matching</h1>
        <p>Browser-only prototype for matching Excel rooms to floor-plan labels.</p>
      </div>

      <div className="upload-grid">
        <label className="field">
          <span>Floor plan</span>
          <select
            value={selectedFloorPlanId}
            onChange={(event) => onFloorPlanFixtureChange(event.target.value)}
          >
            {floorPlanFixtures.map((fixture) => (
              <option key={fixture.id} value={fixture.id}>
                {fixture.label}
              </option>
            ))}
          </select>
          <small>{floorPlanFile ? floorPlanFile.name : "Loading floor plan..."}</small>
        </label>

        <label className="field">
          <span>Room list</span>
          <select
            value={selectedRoomListId}
            onChange={(event) => onRoomListFixtureChange(event.target.value)}
          >
            {roomListFixtures.map((fixture) => (
              <option key={fixture.id} value={fixture.id}>
                {fixture.label}
              </option>
            ))}
          </select>
          <small>{excelFile ? excelFile.name : "Loading spreadsheet..."}</small>
        </label>
      </div>

      <label className="field compact-field">
        <span>OCR strategy</span>
        <select
          value={selectedOcrStrategyId}
          onChange={(event) => onOcrStrategyChange(event.target.value as OcrStrategyId)}
        >
          {ocrStrategies.map((strategy) => (
            <option key={strategy.id} value={strategy.id}>
              {strategy.label}
            </option>
          ))}
        </select>
        <small>
          {ocrStrategies.find((strategy) => strategy.id === selectedOcrStrategyId)?.description}
        </small>
      </label>

      <fieldset className="field checkbox-field">
        <legend>OCR passes</legend>
        <div className="checkbox-grid">
          {ocrPasses.map((pass) => (
            <label key={pass.id}>
              <input
                type="checkbox"
                checked={selectedOcrPassIds.includes(pass.id)}
                onChange={() => onOcrPassToggle(pass.id)}
              />
              <span>{pass.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field checkbox-field">
        <legend>OCR mode</legend>
        <div className="checkbox-grid compact-checkbox-grid">
          <label>
            <input
              type="checkbox"
              checked={selectedOcrModes.includes("tiled")}
              onChange={() => onOcrModeToggle("tiled")}
            />
            <span>Tiled</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={selectedOcrModes.includes("full-page")}
              onChange={() => onOcrModeToggle("full-page")}
            />
            <span>Full page</span>
          </label>
        </div>
      </fieldset>

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
        <span className={spreadsheetStatus.kind === "error" ? "status-text-error" : undefined}>
          {spreadsheetStatus.text}
        </span>
      </div>

      {processingSteps.length > 0 && (
        <div ref={progressRef} className="processing-steps" aria-label="Processing steps">
          {getDisplayedProcessingSteps(processingSteps).map((step, index) => (
            <span key={`${step.message}-${index}`} className={`step-${step.status}`}>
              {step.message}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export function getSpreadsheetStatus(
  parsedRoomList?: ParsedRoomList,
  spreadsheetError?: string
): { kind: "ready" | "error" | "waiting"; text: string } {
  if (parsedRoomList) {
    return {
      kind: "ready",
      text: `${parsedRoomList.rooms.length} rooms detected`
    };
  }

  if (spreadsheetError) {
    return {
      kind: "error",
      text: `Spreadsheet error: ${spreadsheetError}`
    };
  }

  return {
    kind: "waiting",
    text: "Waiting for spreadsheet"
  };
}

export function getDisplayedProcessingSteps(
  processingSteps: OcrPipelineProgress[]
): OcrPipelineProgress[] {
  return processingSteps;
}

export function getProgressScrollTop({
  scrollHeight
}: {
  scrollHeight: number;
}): number {
  return scrollHeight;
}
