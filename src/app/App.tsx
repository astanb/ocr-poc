import { useEffect, useMemo, useState } from "react";
import { DebugPanel } from "../components/DebugPanel";
import { FileUploadPanel } from "../components/FileUploadPanel";
import { FloorPlanViewer } from "../components/FloorPlanViewer";
import { ResultsTable } from "../components/ResultsTable";
import { createExportPayload, downloadJson } from "../lib/export/exportJson";
import { formatErrorDetails, getErrorMessage } from "../lib/errors/formatErrorDetails";
import { parseRoomList } from "../lib/excel/parseRoomList";
import {
  FLOOR_PLAN_FIXTURES,
  ROOM_LIST_FIXTURES,
  getDefaultRoomListIdForFloorPlan,
  getFixtureById,
  loadFixtureFile
} from "../lib/fixtures/fpTestFixtures";
import {
  OCR_STRATEGIES,
  getOcrEngines,
  type OcrStrategyId
} from "../lib/ocr/ocrEngines";
import {
  runOcrMatchPipeline,
  type OcrAttempt,
  type OcrPipelineProgress
} from "../lib/ocr/ocrPipeline";
import {
  OCR_PREPROCESSING_PASSES,
  createOcrPassCanvases,
  type OcrPreprocessingPassId
} from "../lib/ocr/ocrPreprocessing";
import { createOcrTileCanvases } from "../lib/ocr/ocrTiling";
import { extractPdfText } from "../lib/pdf/extractPdfText";
import { renderPdfPage } from "../lib/pdf/renderPdfPage";
import { groupTextItems } from "../lib/matching/groupTextItems";
import { matchRooms } from "../lib/matching/matchRooms";
import {
  getRoomsNeedingOcrRetry,
  mergePdfMatchesWithOcrRetries
} from "../lib/processing/pdfOcrFallback";
import type {
  ExtractedLabelCandidate,
  ExtractedTextItem
} from "../types/floorPlan";
import type { RoomMatch } from "../types/matching";
import type { ParsedRoomList } from "../types/rooms";

type Preview =
  | {
      kind: "canvas";
      canvas: HTMLCanvasElement;
      width: number;
      height: number;
      scale?: number;
    }
  | {
      kind: "image";
      url: string;
      canvas: HTMLCanvasElement;
      width: number;
      height: number;
    };

const LOW_COLUMN_CONFIDENCE = 0.75;

type OcrRunMode = "full-page" | "tiled";

type OcrOptions = {
  passIds: OcrPreprocessingPassId[];
  modes: OcrRunMode[];
};

const DEFAULT_OCR_OPTIONS: OcrOptions = {
  passIds: ["raw"],
  modes: ["tiled"]
};

export function App() {
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState(FLOOR_PLAN_FIXTURES[0]?.id ?? "");
  const [selectedRoomListId, setSelectedRoomListId] = useState(ROOM_LIST_FIXTURES[0]?.id ?? "");
  const [selectedOcrStrategyId, setSelectedOcrStrategyId] =
    useState<OcrStrategyId>("compare-all");
  const [ocrOptions, setOcrOptions] = useState<OcrOptions>(DEFAULT_OCR_OPTIONS);
  const [autoFocusSelectedPin, setAutoFocusSelectedPin] = useState(false);
  const [floorPlanFile, setFloorPlanFile] = useState<File>();
  const [excelFile, setExcelFile] = useState<File>();
  const [selectedColumn, setSelectedColumn] = useState("");
  const [parsedRoomList, setParsedRoomList] = useState<ParsedRoomList>();
  const [preview, setPreview] = useState<Preview>();
  const [textItems, setTextItems] = useState<ExtractedTextItem[]>([]);
  const [candidates, setCandidates] = useState<ExtractedLabelCandidate[]>([]);
  const [matches, setMatches] = useState<RoomMatch[]>([]);
  const [ocrAttempts, setOcrAttempts] = useState<OcrAttempt[]>([]);
  const [processingSteps, setProcessingSteps] = useState<OcrPipelineProgress[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [spreadsheetError, setSpreadsheetError] = useState<string>();
  const [errorDetails, setErrorDetails] = useState("");
  const [processingDurationMs, setProcessingDurationMs] = useState<number>();
  const [message, setMessage] = useState("Upload a floor plan and room list to begin.");

  useEffect(() => {
    return () => {
      if (preview?.kind === "image") {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview]);

  useEffect(() => {
    function handleWindowError(event: ErrorEvent) {
      setErrorDetails(formatErrorDetails(event.error ?? event.message, "Window error"));
      setMessage(getErrorMessage(event.error ?? event.message));
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      setErrorDetails(formatErrorDetails(event.reason, "Unhandled promise rejection"));
      setMessage(getErrorMessage(event.reason));
    }

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (!selectedFloorPlanId) {
      setFloorPlanFile(undefined);
      return;
    }

    const fixture = getFixtureById(FLOOR_PLAN_FIXTURES, selectedFloorPlanId);
    if (!fixture) {
      setFloorPlanFile(undefined);
      setMessage("Selected floor-plan fixture could not be found.");
      return;
    }

    let cancelled = false;
    setFloorPlanFile(undefined);
    clearResults();
    setMessage(`Loading ${fixture.fileName}...`);

    loadFixtureFile(fixture)
      .then((file) => {
        if (!cancelled) {
          setFloorPlanFile(file);
          setMessage(`Loaded ${fixture.fileName}.`);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFloorPlanFile(undefined);
          setErrorDetails(formatErrorDetails(error, "Floor-plan fixture load error"));
          setMessage(getErrorMessage(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFloorPlanId]);

  useEffect(() => {
    if (!selectedRoomListId) {
      setExcelFile(undefined);
      return;
    }

    const fixture = getFixtureById(ROOM_LIST_FIXTURES, selectedRoomListId);
    if (!fixture) {
      setExcelFile(undefined);
      setMessage("Selected room-list fixture could not be found.");
      return;
    }

    let cancelled = false;
    setExcelFile(undefined);
    setParsedRoomList(undefined);
    setSelectedColumn("");
    setSpreadsheetError(undefined);
    clearResults();
    setMessage(`Loading ${fixture.fileName}...`);

    loadFixtureFile(fixture)
      .then((file) => {
        if (!cancelled) {
          setExcelFile(file);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setExcelFile(undefined);
          const errorMessage = getErrorMessage(error);
          setSpreadsheetError(errorMessage);
          setErrorDetails(formatErrorDetails(error, "Room-list fixture load error"));
          setMessage(errorMessage);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRoomListId]);

  useEffect(() => {
    if (!excelFile) {
      setParsedRoomList(undefined);
      setSelectedColumn("");
      setSpreadsheetError(undefined);
      return;
    }

    let cancelled = false;
    setParsedRoomList(undefined);
    setSelectedColumn("");
    setSpreadsheetError(undefined);
    setMessage("Reading spreadsheet...");

    excelFile
      .arrayBuffer()
      .then(async (buffer) => {
        if (cancelled) {
          return;
        }
        const parsed = await parseRoomList(buffer);
        setParsedRoomList(parsed);
        setSelectedColumn(parsed.selectedColumn);
        setSpreadsheetError(undefined);
        setMessage(`Loaded ${parsed.rooms.length} rooms from the spreadsheet.`);
      })
      .catch((error: unknown) => {
        const errorMessage = getErrorMessage(error);
        setParsedRoomList(undefined);
        setSelectedColumn("");
        setSpreadsheetError(errorMessage);
        setErrorDetails(formatErrorDetails(error, "Spreadsheet parse error"));
        setMessage(errorMessage);
      });

    return () => {
      cancelled = true;
    };
  }, [excelFile]);

  async function handleColumnChange(column: string) {
    setSelectedColumn(column);
    if (!excelFile) {
      return;
    }

    const parsed = await parseRoomList(await excelFile.arrayBuffer(), column);
    setParsedRoomList(parsed);
  }

  function handleFloorPlanFixtureChange(fixtureId: string) {
    setSelectedFloorPlanId(fixtureId);
    setSelectedRoomListId(getDefaultRoomListIdForFloorPlan(fixtureId));
  }

  function handleRoomListFixtureChange(fixtureId: string) {
    setSelectedRoomListId(fixtureId);
  }

  async function processFiles() {
    if (!floorPlanFile || !excelFile || !parsedRoomList) {
      return;
    }

    setIsProcessing(true);
    setErrorDetails("");
    setProcessingSteps([]);
    setSelectedRoomId(undefined);
    setProcessingDurationMs(undefined);
    setMessage("Processing files locally in the browser...");

    try {
      const startedAt = now();
      const floorPreview = await buildPreview(floorPlanFile);
      const processed = await processFloorPlanText(
        floorPlanFile,
        floorPreview,
        parsedRoomList.rooms,
        selectedOcrStrategyId,
        ocrOptions,
        (progress) => {
          setProcessingSteps((current) => [...current.slice(-80), progress]);
          setMessage(progress.message);
        }
      );

      setPreview(floorPreview);
      setTextItems(processed.textItems);
      setCandidates(processed.candidates);
      setMatches(processed.matches);
      setOcrAttempts(processed.ocrAttempts);
      setProcessingDurationMs(now() - startedAt);
      setMessage(
        `Processed ${parsedRoomList.rooms.length} rooms, ${processed.textItems.length} text items, and ${processed.candidates.length} label candidates.`
      );
    } catch (error: unknown) {
      setErrorDetails(formatErrorDetails(error, "Processing error"));
      setMessage(getErrorMessage(error));
    } finally {
      setIsProcessing(false);
    }
  }

  function correctMatch(roomId: string, x: number, y: number) {
    setMatches((current) =>
      current.map((match) =>
        match.roomId === roomId
          ? {
              ...match,
              x,
              y,
              status: "corrected",
              confidence: Math.max(match.confidence, 1),
              reason: "Pin was manually corrected."
            }
          : match
      )
    );
  }

  function clearResults() {
    setPreview(undefined);
    setTextItems([]);
    setCandidates([]);
    setMatches([]);
    setOcrAttempts([]);
    setProcessingSteps([]);
    setSelectedRoomId(undefined);
    setProcessingDurationMs(undefined);
  }

  const exportPayload = useMemo(
    () =>
      createExportPayload({
        floorPlanFileName: floorPlanFile?.name,
        excelFileName: excelFile?.name,
        rooms: matches,
        extractedCandidates: candidates
      }),
    [candidates, excelFile?.name, floorPlanFile?.name, matches]
  );

  function exportResults() {
    downloadJson(exportPayload, "room-matches.json");
  }

  const shouldConfirmColumn =
    parsedRoomList !== undefined &&
    parsedRoomList.columns.length > 1 &&
    parsedRoomList.confidence < LOW_COLUMN_CONFIDENCE;

  return (
    <main className="app-shell">
      <section className="workspace">
        <FileUploadPanel
          floorPlanFixtures={FLOOR_PLAN_FIXTURES}
          roomListFixtures={ROOM_LIST_FIXTURES}
          selectedFloorPlanId={selectedFloorPlanId}
          selectedRoomListId={selectedRoomListId}
          floorPlanFile={floorPlanFile}
          excelFile={excelFile}
          parsedRoomList={parsedRoomList}
          spreadsheetError={spreadsheetError}
          selectedColumn={selectedColumn}
          shouldConfirmColumn={shouldConfirmColumn}
          isProcessing={isProcessing}
          onFloorPlanFixtureChange={handleFloorPlanFixtureChange}
          onRoomListFixtureChange={handleRoomListFixtureChange}
          ocrStrategies={OCR_STRATEGIES}
          selectedOcrStrategyId={selectedOcrStrategyId}
          ocrPasses={OCR_PREPROCESSING_PASSES}
          selectedOcrPassIds={ocrOptions.passIds}
          selectedOcrModes={ocrOptions.modes}
          autoFocusSelectedPin={autoFocusSelectedPin}
          processingSteps={processingSteps}
          onOcrStrategyChange={setSelectedOcrStrategyId}
          onOcrPassToggle={(passId) => {
            setOcrOptions((current) => ({
              ...current,
              passIds: toggleRequiredValue(current.passIds, passId)
            }));
          }}
          onOcrModeToggle={(mode) => {
            setOcrOptions((current) => ({
              ...current,
              modes: toggleRequiredValue(current.modes, mode)
            }));
          }}
          onAutoFocusSelectedPinToggle={() => setAutoFocusSelectedPin((current) => !current)}
          onColumnChange={handleColumnChange}
          onProcess={processFiles}
        />

        <FloorPlanViewer
          preview={preview}
          matches={matches}
          selectedRoomId={selectedRoomId}
          autoFocusSelectedPin={autoFocusSelectedPin}
          onRoomSelect={setSelectedRoomId}
          onPinMove={correctMatch}
        />

        <ResultsTable
          matches={matches}
          ocrAttempts={ocrAttempts}
          selectedRoomId={selectedRoomId}
          onRoomSelect={setSelectedRoomId}
          onExport={exportResults}
        />
      </section>

      <DebugPanel
        message={message}
        processingDurationMs={processingDurationMs}
        textItems={textItems}
        candidates={candidates}
        matches={matches}
        rooms={parsedRoomList?.rooms ?? []}
        errorDetails={errorDetails}
      />
    </main>
  );
}

async function buildPreview(file: File): Promise<Preview> {
  if (isPdf(file)) {
    const rendered = await renderPdfPage(file);
    return {
      kind: "canvas",
      canvas: rendered.canvas,
      width: rendered.width,
      height: rendered.height,
      scale: rendered.scale
    };
  }

  return loadImagePreview(file);
}

async function processFloorPlanText(
  file: File,
  preview: Preview,
  rooms: ParsedRoomList["rooms"],
  ocrStrategyId: OcrStrategyId,
  ocrOptions: OcrOptions,
  onProgress?: (progress: OcrPipelineProgress) => void
): Promise<{
  textItems: ExtractedTextItem[];
  candidates: ExtractedLabelCandidate[];
  matches: RoomMatch[];
  ocrAttempts: OcrAttempt[];
}> {
  if (isPdf(file)) {
    const pdfText = await extractPdfText(
      file,
      undefined,
      preview.kind === "canvas" ? preview.scale : undefined
    );
    const pdfCandidates = groupTextItems(pdfText);
    const pdfMatches = matchRooms(rooms, pdfCandidates);
    const roomsNeedingOcr = getRoomsNeedingOcrRetry(rooms, pdfMatches);

    if (roomsNeedingOcr.length === 0 || preview.kind !== "canvas") {
      return {
        textItems: pdfText,
        candidates: pdfCandidates,
        matches: pdfMatches,
        ocrAttempts: []
      };
    }

    const ocrPipeline = await runOcrMatchPipeline({
      image: preview.canvas,
      rooms: roomsNeedingOcr,
      engines: getOcrEngines(ocrStrategyId),
      passes: createOcrPassInputs(preview.canvas, ocrOptions),
      onProgress
    });

    return {
      textItems: [...pdfText, ...ocrPipeline.textItems],
      candidates: [...pdfCandidates, ...ocrPipeline.candidates],
      matches: mergePdfMatchesWithOcrRetries(pdfMatches, ocrPipeline.matches),
      ocrAttempts: ocrPipeline.attempts
    };
  }

  const ocrPipeline = await runOcrMatchPipeline({
    image: preview.kind === "image" ? preview.canvas : file,
    rooms,
    engines: getOcrEngines(ocrStrategyId),
    passes: preview.kind === "image"
      ? createOcrPassInputs(preview.canvas, ocrOptions)
      : undefined,
    onProgress
  });

  return {
    textItems: ocrPipeline.textItems,
    candidates: ocrPipeline.candidates,
    matches: ocrPipeline.matches,
    ocrAttempts: ocrPipeline.attempts
  };
}

export function createOcrPassInputs(
  source: HTMLCanvasElement,
  options: OcrOptions = DEFAULT_OCR_OPTIONS
) {
  const selectedPasses = OCR_PREPROCESSING_PASSES.filter((pass) =>
    options.passIds.includes(pass.id)
  );
  const includeTiled = options.modes.includes("tiled");

  return createOcrPassCanvases(source, selectedPasses).map((pass) => ({
    id: pass.id,
    label: pass.label,
    image: pass.canvas,
    runFullPage: options.modes.includes("full-page"),
    tiledImages: includeTiled
      ? createOcrTileCanvases(pass.canvas).map((tile) => ({
        ...tile,
        label: tile.id,
        image: tile.canvas
      }))
      : undefined
  }));
}

function toggleRequiredValue<TValue>(values: TValue[], value: TValue): TValue[] {
  if (values.includes(value)) {
    return values.length === 1 ? values : values.filter((current) => current !== value);
  }

  return [...values, value];
}

function loadImagePreview(file: File): Promise<Preview> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not create the image OCR canvas."));
        return;
      }
      context.drawImage(image, 0, 0);
      resolve({
        kind: "image",
        url,
        canvas,
        width: image.naturalWidth,
        height: image.naturalHeight
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load the image floor plan."));
    };
    image.src = url;
  });
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function now(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}
