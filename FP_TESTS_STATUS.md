# FP_Tests Corpus Status

Run date: 2026-06-26

This report covers every floor-plan file found in `/Users/alexstanbury/Downloads/FP_Tests` with a matching numbered `.xlsx` room list.

Accuracy caveat: there is no human-labelled ground truth in the fixture folder, so the percentages below are automatic matching confidence metrics, not audited real-world accuracy. Treat `matched` as "high-confidence automatic match", `ambiguous` as "needs review", and `unmatched` as "not found by the current pipeline".

## Summary

| Metric | Value |
| --- | ---: |
| Floor-plan files tested | 14 |
| Room-list rows evaluated | 1,784 |
| Confident matches | 833 |
| Ambiguous matches | 164 |
| Unmatched rooms | 787 |
| Overall confident match rate | 46.7% |
| Overall found-or-reviewable rate | 55.9% |

The strongest results are on PDFs with usable text layers and clear room-code labels: `3.pdf`, `7-GF.pdf`, `6-GF.pdf`, and `9-GF.pdf`. The weakest results are `4.pdf` and `9-FF.pdf`, where PDF text extraction produced very few useful text items, suggesting the app needs OCR fallback for low-quality PDF text layers rather than only for completely empty text layers.

Several spreadsheets appear to contain multiple floors while individual PDFs are floor-specific. Those split-floor plans are currently measured against the full spreadsheet, so their match rates are lower than the visible-floor performance would be after floor filtering.

## Per-Plan Results

| Set | Floor plan | Rooms | Text items | Label candidates | Matched | Ambiguous | Unmatched | Confident match rate | Status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | `1.jpg` | 89 | 264 | 205 | 37 | 5 | 47 | 41.6% | Needs OCR/matching iteration |
| 2 | `2-1F.pdf` | 82 | 30 | 17 | 20 | 4 | 58 | 24.4% | Floor-specific text sparse |
| 2 | `2-GF.pdf` | 82 | 201 | 155 | 55 | 12 | 15 | 67.1% | Good, with review queue |
| 2 | `2-LG.pdf` | 82 | 81 | 56 | 39 | 6 | 37 | 47.6% | Partial coverage |
| 3 | `3.pdf` | 112 | 221 | 175 | 97 | 10 | 5 | 86.6% | Strong |
| 4 | `4.pdf` | 125 | 17 | 10 | 2 | 2 | 121 | 1.6% | Blocked by poor PDF text extraction |
| 5 | `5.pdf` | 416 | 1,057 | 1,014 | 237 | 3 | 176 | 57.0% | Large multi-page partial success |
| 6 | `6-GF.pdf` | 110 | 664 | 501 | 84 | 13 | 13 | 76.4% | Strong, with review queue |
| 6 | `6-Mez.pdf` | 110 | 85 | 60 | 30 | 15 | 65 | 27.3% | Floor-specific partial coverage |
| 7 | `7-1F.pdf` | 88 | 28 | 21 | 18 | 17 | 53 | 20.5% | Sparse text and high ambiguity |
| 7 | `7-GF.pdf` | 88 | 166 | 123 | 71 | 11 | 6 | 80.7% | Strong |
| 8 | `8.pdf` | 86 | 465 | 276 | 31 | 41 | 14 | 36.0% | Many labels found, high ambiguity |
| 9 | `9-FF.pdf` | 157 | 38 | 24 | 2 | 1 | 154 | 1.3% | Blocked by poor PDF text extraction |
| 9 | `9-GF.pdf` | 157 | 871 | 701 | 110 | 24 | 23 | 70.1% | Good, with review queue |

## What Changed During Testing

- Image OCR now requests Tesseract TSV output and uses sparse-text page segmentation, which made the JPEG fixture produce usable word boxes.
- Room-code normalization now corrects common OCR substitutions inside codes, for example `GFO40` to `GF040` and `GFOI7` to `GF017`.
- Multi-page PDF extraction now reads every page rather than only page 1.
- Fuzzy name fallback uses the third-party `fast-fuzzy` package instead of a hand-rolled fuzzy scorer. Domain-specific room-code normalization remains local because generic fuzzy libraries do not know the room-code conventions.
- Fuzzy name matching is gated so coded spreadsheet rooms do not match uncoded text labels purely by similar words.

## Recommended Next Fixes

1. Add low-quality PDF text-layer detection and OCR fallback when extracted PDF text is sparse or has too few room-code-like labels. This is the main blocker for `4.pdf` and `9-FF.pdf`.
2. Add floor filtering from the spreadsheet so floor-specific PDFs are compared only with rooms expected on that floor.
3. Add a review/export mode for ambiguous matches; `8.pdf`, `9-GF.pdf`, `7-1F.pdf`, and `6-Mez.pdf` would benefit most.
4. Add human-labelled expected matches for at least one strong, one medium, and one weak fixture so future reports can measure actual precision/recall rather than confidence proxies.

## Verification Commands

- `npm test` passed: 7 test files, 15 tests.
- `npm run build` passed.
- `npx vitest run src/lib/benchmark/fpTestsCorpus.test.ts --reporter verbose` passed and produced the table above.
