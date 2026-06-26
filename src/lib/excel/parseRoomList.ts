import { readSheet } from "read-excel-file/browser";
import type { ParsedRoomList, RoomListItem } from "../../types/rooms";
import { extractRoomCode, normalizeText } from "../matching/normalize";

const HEADER_HINTS = new Map<string, number>([
  ["room", 0.9],
  ["room name", 1],
  ["room_name", 1],
  ["name", 0.65],
  ["description", 0.55],
  ["location", 0.85],
  ["room id", 0.95],
  ["room code", 0.95]
]);

type CellValue = string | number | boolean | Date | null;
type SpreadsheetRow = CellValue[];

export async function parseRoomList(
  workbookData: ArrayBuffer,
  selectedColumn?: string
): Promise<ParsedRoomList> {
  const rows = await readSheet(workbookData);
  if (rows.length === 0) {
    return {
      rooms: [],
      columns: [],
      selectedColumn: "",
      confidence: 0
    };
  }

  const [headerRow, ...dataRows] = rows as SpreadsheetRow[];
  const columns = headerRow.map((cell, index) =>
    getCellText(cell) || `Column ${index + 1}`
  );
  const detected = detectRoomColumn(columns);
  const column = selectedColumn && columns.includes(selectedColumn)
    ? selectedColumn
    : detected.column ?? columns[0] ?? "";

  return {
    rooms: extractRows(dataRows, columns, column),
    columns,
    detectedColumn: detected.column,
    selectedColumn: column,
    confidence: selectedColumn ? 1 : detected.confidence
  };
}

function detectRoomColumn(columns: string[]): {
  column?: string;
  confidence: number;
} {
  let best: { column?: string; confidence: number } = { confidence: 0 };

  for (const column of columns) {
    const normalized = column.trim().toLowerCase();
    const directScore = HEADER_HINTS.get(normalized) ?? 0;
    const containsScore = [...HEADER_HINTS.entries()].reduce(
      (score, [hint, confidence]) =>
        normalized.includes(hint) ? Math.max(score, confidence - 0.1) : score,
      0
    );
    const confidence = Math.max(directScore, containsScore);

    if (confidence > best.confidence) {
      best = { column, confidence };
    }
  }

  return best;
}

function extractRows(
  rows: SpreadsheetRow[],
  columns: string[],
  selectedColumn: string
): RoomListItem[] {
  const columnIndex = columns.indexOf(selectedColumn);
  if (columnIndex === -1) {
    return [];
  }

  return rows.flatMap((row, index) => {
    const rawName = getCellText(row[columnIndex]);
    if (!rawName) {
      return [];
    }

    return {
      id: `room-${index + 2}`,
      rawName,
      normalizedName: normalizeText(rawName),
      possibleCode: extractRoomCode(rawName)
    };
  });
}

function getCellText(value: CellValue): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value ?? "").trim();
}
