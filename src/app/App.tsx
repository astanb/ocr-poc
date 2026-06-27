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
import { extractImageText } from "../lib/ocr/extractImageText";
import { extractPdfText } from "../lib/pdf/extractPdfText";
import { renderPdfPage } from "../lib/pdf/renderPdfPage";
import { groupTextItems } from "../lib/matching/groupTextItems";
import { matchRooms } from "../lib/matching/matchRooms";
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
    }
  | {
      kind: "image";
      url: string;
      width: number;
      height: number;
    };

const LOW_COLUMN_CONFIDENCE = 0.75;

export function App() {
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState(FLOOR_PLAN_FIXTURES[0]?.id ?? "");
  const [selectedRoomListId, setSelectedRoomListId] = useState(ROOM_LIST_FIXTURES[0]?.id ?? "");
  const [floorPlanFile, setFloorPlanFile] = useState<File>();
  const [excelFile, setExcelFile] = useState<File>();
  const [selectedColumn, setSelectedColumn] = useState("");
  const [parsedRoomList, setParsedRoomList] = useState<ParsedRoomList>();
  const [preview, setPreview] = useState<Preview>();
  const [textItems, setTextItems] = useState<ExtractedTextItem[]>([]);
  const [candidates, setCandidates] = useState<ExtractedLabelCandidate[]>([]);
  const [matches, setMatches] = useState<RoomMatch[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [spreadsheetError, setSpreadsheetError] = useState<string>();
  const [errorDetails, setErrorDetails] = useState("");
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
    setMessage("Processing files locally in the browser...");

    try {
      const floorPreview = await buildPreview(floorPlanFile);
      const extracted = await extractText(floorPlanFile, floorPreview);
      const grouped = groupTextItems(extracted);
      const roomMatches = matchRooms(parsedRoomList.rooms, grouped);

      setPreview(floorPreview);
      setTextItems(extracted);
      setCandidates(grouped);
      setMatches(roomMatches);
      setMessage(
        `Processed ${parsedRoomList.rooms.length} rooms, ${extracted.length} text items, and ${grouped.length} label candidates.`
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
          onColumnChange={handleColumnChange}
          onProcess={processFiles}
        />

        <FloorPlanViewer
          preview={preview}
          matches={matches}
          onPinMove={correctMatch}
        />

        <ResultsTable matches={matches} onExport={exportResults} />
      </section>

      <DebugPanel
        message={message}
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
      height: rendered.height
    };
  }

  return loadImagePreview(file);
}

async function extractText(
  file: File,
  preview: Preview
): Promise<ExtractedTextItem[]> {
  if (isPdf(file)) {
    const pdfText = await extractPdfText(file);
    if (pdfText.length > 0) {
      return pdfText;
    }

    if (preview.kind === "canvas") {
      return extractImageText(preview.canvas);
    }
  }

  return extractImageText(file);
}

function loadImagePreview(file: File): Promise<Preview> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({
        kind: "image",
        url,
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
