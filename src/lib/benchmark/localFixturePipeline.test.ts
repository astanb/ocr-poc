// @vitest-environment node

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseRoomList } from "../excel/parseRoomList";
import { groupTextItems } from "../matching/groupTextItems";
import { matchRooms } from "../matching/matchRooms";
import { extractImageText } from "../ocr/extractImageText";

const floorPlanPath = "/Users/alexstanbury/Downloads/FP_Tests/1.jpg";
const roomListPath = "/Users/alexstanbury/Downloads/FP_Tests/1.xlsx";

const describeIfFixtureExists =
  existsSync(floorPlanPath) && existsSync(roomListPath) ? describe : describe.skip;

describeIfFixtureExists("local fixture pipeline", () => {
  it("matches visible OCR room codes from the image fixture", async () => {
    const spreadsheet = await readFile(roomListPath);
    const parsedRooms = await parseRoomList(
      spreadsheet.buffer.slice(
        spreadsheet.byteOffset,
        spreadsheet.byteOffset + spreadsheet.byteLength
      )
    );
    const textItems = await extractImageText(floorPlanPath);
    const candidates = groupTextItems(textItems);
    const matches = matchRooms(parsedRooms.rooms, candidates);
    const matched = matches.filter((match) => match.status === "matched");
    const correctedOrMatched = matches.filter(
      (match) => match.status === "matched" || match.status === "corrected"
    );

    console.log(
      JSON.stringify(
        {
          rooms: parsedRooms.rooms.length,
          textItems: textItems.length,
          candidates: candidates.length,
          matched: matched.length,
          matchedOrCorrected: correctedOrMatched.length,
          sampleMatches: matches
            .filter((match) => match.status !== "unmatched")
            .slice(0, 12)
        },
        null,
        2
      )
    );

    expect(
      matches.find((match) => match.roomRawName.startsWith("GF040 -"))
    ).toMatchObject({
      status: "matched",
      confidence: 0.95,
      reason: "Unique exact room-code match with supporting name overlap."
    });
  }, 30_000);
});
