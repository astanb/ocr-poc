// @vitest-environment node

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { DOMParser } from "@xmldom/xmldom";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import type { ExtractedTextItem } from "../../types/floorPlan";
import { parseRoomList } from "../excel/parseRoomList";
import { groupTextItems } from "../matching/groupTextItems";
import { matchRooms } from "../matching/matchRooms";
import { extractImageText } from "../ocr/extractImageText";

const corpusDir = "/Users/alexstanbury/Downloads/FP_Tests";

globalThis.DOMParser ??= DOMParser as typeof globalThis.DOMParser;

type CorpusResult = {
  set: string;
  floorPlan: string;
  rooms: number;
  textItems: number;
  candidates: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  matchRate: number;
};

const describeIfCorpusExists = existsSync(corpusDir) ? describe : describe.skip;

describeIfCorpusExists("FP_Tests corpus benchmark", () => {
  it("extracts and matches across the available fixture sets", async () => {
    const results = await runCorpusBenchmark();
    const usableResults = results.filter((result) => result.textItems > 0);

    console.log(JSON.stringify(results, null, 2));

    expect(results.length).toBeGreaterThan(0);
    expect(usableResults.length).toBeGreaterThan(0);
    expect(
      usableResults.reduce((sum, result) => sum + result.matched, 0)
    ).toBeGreaterThan(0);
  }, 90_000);
});

async function runCorpusBenchmark(): Promise<CorpusResult[]> {
  const files = await readdir(corpusDir);
  const roomLists = files
    .filter((file) => /^\d+\.xlsx$/u.test(file))
    .sort((a, b) => Number.parseInt(a) - Number.parseInt(b));
  const results: CorpusResult[] = [];

  for (const roomList of roomLists) {
    const set = roomList.replace(".xlsx", "");
    const floorPlans = files
      .filter((file) => isFloorPlanForSet(file, set))
      .sort();
    const spreadsheet = await readFile(path.join(corpusDir, roomList));
    const parsedRooms = await parseRoomList(
      spreadsheet.buffer.slice(
        spreadsheet.byteOffset,
        spreadsheet.byteOffset + spreadsheet.byteLength
      )
    );

    for (const floorPlan of floorPlans) {
      const textItems = await extractFloorPlanText(path.join(corpusDir, floorPlan));
      const candidates = groupTextItems(textItems);
      const matches = matchRooms(parsedRooms.rooms, candidates);
      const matched = matches.filter((match) => match.status === "matched").length;
      const ambiguous = matches.filter((match) => match.status === "ambiguous").length;
      const unmatched = matches.filter((match) => match.status === "unmatched").length;

      results.push({
        set,
        floorPlan,
        rooms: parsedRooms.rooms.length,
        textItems: textItems.length,
        candidates: candidates.length,
        matched,
        ambiguous,
        unmatched,
        matchRate: Number((matched / parsedRooms.rooms.length).toFixed(3))
      });
    }
  }

  return results;
}

function isFloorPlanForSet(file: string, set: string): boolean {
  return (
    (file === `${set}.jpg` ||
      file === `${set}.jpeg` ||
      file === `${set}.png` ||
      file === `${set}.pdf` ||
      file.startsWith(`${set}-`)) &&
    /\.(?:jpe?g|png|pdf)$/iu.test(file)
  );
}

async function extractFloorPlanText(filePath: string): Promise<ExtractedTextItem[]> {
  if (/\.pdf$/iu.test(filePath)) {
    return extractPdfTextFromPdfFile(filePath);
  }

  return extractImageText(filePath);
}

async function extractPdfTextFromPdfFile(filePath: string): Promise<ExtractedTextItem[]> {
  const data = new Uint8Array(await readFile(filePath));
  const document = await pdfjsLib.getDocument({ data }).promise;
  const pages = await Promise.all(
    Array.from({ length: document.numPages }, async (_, index) => {
      const pageNumber = index + 1;
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const content = await page.getTextContent();

      return content.items.flatMap((item): ExtractedTextItem[] => {
        if (!isPdfTextItem(item) || item.str.trim().length === 0) {
          return [];
        }

        const transformed = pdfjsLib.Util.transform(viewport.transform, item.transform);
        return [
          {
            text: item.str,
            page: pageNumber,
            x: transformed[4],
            y: transformed[5] - item.height * 1.5,
            width: item.width * 1.5,
            height: item.height * 1.5,
            source: "pdf-text"
          }
        ];
      });
    })
  );

  return pages.flat();
}

function isPdfTextItem(
  item: unknown
): item is { str: string; transform: number[]; width: number; height: number } {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    "transform" in item &&
    "width" in item &&
    "height" in item
  );
}
