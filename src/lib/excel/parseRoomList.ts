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
  const rows = await readSpreadsheetRows(workbookData);
  return parseRoomRows(rows, selectedColumn);
}

async function readSpreadsheetRows(workbookData: ArrayBuffer): Promise<SpreadsheetRow[]> {
  const bytes = new Uint8Array(workbookData);

  if (isZipWorkbook(bytes)) {
    return readSheet(workbookData) as Promise<SpreadsheetRow[]>;
  }

  if (isOleWorkbook(bytes)) {
    throw new Error(
      "This looks like an older .xls workbook. Please save it as .xlsx, CSV, or HTML and upload it again."
    );
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const rows = parseTextSpreadsheetRows(text);

  if (rows.length > 0) {
    return rows;
  }

  throw new Error(
    "The room list is not a readable .xlsx workbook, HTML table, CSV, or TSV file."
  );
}

function parseRoomRows(
  rows: SpreadsheetRow[],
  selectedColumn?: string
): ParsedRoomList {
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

function isZipWorkbook(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function isOleWorkbook(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  );
}

function parseTextSpreadsheetRows(text: string): SpreadsheetRow[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  if (looksLikeHtml(trimmed)) {
    const htmlRows = parseHtmlTableRows(trimmed);
    if (htmlRows.length > 0) {
      return htmlRows;
    }
  }

  return parseDelimitedRows(trimmed);
}

function looksLikeHtml(text: string): boolean {
  return /^<!doctype html\b|^<html\b|<table[\s>]/iu.test(text);
}

function parseHtmlTableRows(html: string): SpreadsheetRow[] {
  const document = new DOMParser().parseFromString(html, "text/html");

  return [...document.querySelectorAll("tr")]
    .map((row) =>
      [...row.cells].map((cell) => cell.textContent?.replace(/\s+/gu, " ").trim() ?? "")
    )
    .filter((row) => row.some((cell) => cell.length > 0));
}

function parseDelimitedRows(text: string): SpreadsheetRow[] {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const delimiter = countCharacter(lines[0], "\t") > countCharacter(lines[0], ",")
    ? "\t"
    : ",";

  return lines
    .map((line) => parseDelimitedLine(line, delimiter))
    .filter((row) => row.some((cell) => cell.length > 0));
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === "\"" && nextCharacter === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }

    if (character === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === delimiter && !inQuotes) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }

    cell += character;
  }

  cells.push(cell.trim());
  return cells;
}

function countCharacter(text: string, character: string): number {
  return [...text].filter((value) => value === character).length;
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
