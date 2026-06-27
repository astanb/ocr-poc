import { describe, expect, it } from "vitest";
import { parseTesseractTsv } from "./parseTesseractTsv";

describe("parseTesseractTsv", () => {
  it("extracts word boxes from Tesseract TSV output", () => {
    const items = parseTesseractTsv(
      [
        "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
        "5\t1\t1\t1\t1\t1\t1218\t115\t28\t14\t96.8\tPlay",
        "5\t1\t1\t1\t1\t2\t1251\t118\t33\t8\t94.2\troom",
        "5\t1\t1\t1\t2\t1\t1225\t135\t39\t12\t88.1\tGF040",
        "4\t1\t1\t1\t2\t0\t1220\t130\t80\t20\t-1\t",
        "5\t1\t1\t1\t3\t1\t1220\t150\t20\t8\t12.0\tnoise"
      ].join("\n"),
      1
    );

    expect(items).toEqual([
      {
        text: "Play",
        page: 1,
        x: 1218,
        y: 115,
        width: 28,
        height: 14,
        source: "ocr:tesseract"
      },
      {
        text: "room",
        page: 1,
        x: 1251,
        y: 118,
        width: 33,
        height: 8,
        source: "ocr:tesseract"
      },
      {
        text: "GF040",
        page: 1,
        x: 1225,
        y: 135,
        width: 39,
        height: 12,
        source: "ocr:tesseract"
      }
    ]);
  });

  it("extracts word boxes from headerless Tesseract TSV output", () => {
    const items = parseTesseractTsv(
      [
        "1\t1\t0\t0\t0\t0\t0\t0\t1848\t1744\t-1\t",
        "5\t1\t1\t1\t1\t1\t1218\t115\t28\t14\t96.8\tPlay",
        "5\t1\t1\t1\t1\t2\t1251\t118\t33\t8\t94.2\troom",
        "5\t1\t1\t1\t2\t1\t1225\t135\t39\t12\t88.1\tGF040"
      ].join("\n"),
      1
    );

    expect(items.map((item) => item.text)).toEqual(["Play", "room", "GF040"]);
  });
});
