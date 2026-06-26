# OCR Floor Plan Room Matching POC Plan

Build a simple browser-only prototype web app for matching a room list from Excel to room label locations on a floor plan.

The user will upload:

1. A floor plan file: PDF, PNG, JPG, or JPEG.
2. An Excel file: XLSX, containing a column with room names / room identifiers.

The app should process both locally in the browser and attempt to locate each Excel room on the floor plan.

## Core Requirements

Use this processing pipeline:

1. Parse the Excel file.
2. Let the user select the room-name column if it cannot be confidently detected.
3. Extract room names from that column.
4. If the floor plan is a PDF:
   - Use `pdfjs-dist`.
   - Render at least the first page.
   - Attempt text extraction with `page.getTextContent()`.
   - Capture text plus x/y/width/height/page coordinates.
   - Use PDF.js viewport transforms so extracted coordinates align with the rendered preview.
5. If the input is an image, or if the PDF has no useful text layer:
   - Use OCR fallback with `tesseract.js`.
   - Capture recognised text and approximate bounding boxes.
6. Group nearby extracted text chunks into room-label candidates.
7. Match the Excel room list against those label candidates.
8. Display the floor plan with pins over likely room locations.
9. Show a results table with:
   - room name from Excel
   - matched floor-plan text
   - page number
   - x coordinate
   - y coordinate
   - confidence
   - status: matched, ambiguous, unmatched, or corrected
   - reason
10. Allow the user to drag pins to correct them.
11. Allow export of the final result as JSON.

Keep this as an MVP. Prioritise clear, debuggable, deterministic logic over perfect accuracy.

## Suggested Stack

Use:

- React
- TypeScript
- Vite
- `pdfjs-dist`
- `xlsx` or SheetJS
- `tesseract.js`
- simple CSS or existing app styling

Do not add a backend. All processing should happen client-side.

## Types To Use

Create types similar to:

```ts
export type ExtractedTextItem = {
  text: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  source: "pdf-text" | "ocr";
};

export type ExtractedLabelCandidate = {
  id: string;
  rawText: string;
  normalizedText: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  source: "pdf-text" | "ocr" | "mixed";
  childItems: ExtractedTextItem[];
};

export type RoomListItem = {
  id: string;
  rawName: string;
  normalizedName: string;
  possibleCode?: string;
};

export type RoomMatch = {
  roomId: string;
  roomRawName: string;
  matchedCandidateId?: string;
  matchedText?: string;
  page?: number;
  x?: number;
  y?: number;
  confidence: number;
  status: "matched" | "ambiguous" | "unmatched" | "corrected";
  reason: string;
  alternatives?: Array<{
    candidateId: string;
    text: string;
    x: number;
    y: number;
    confidence: number;
    reason: string;
  }>;
};
```

## Excel Parsing

Implement `parseRoomList`.

Requirements:

- Read the first worksheet by default.
- Detect likely room-name columns from headers such as:
  - room
  - room name
  - room_name
  - name
  - description
  - location
  - room id
  - room code
- If confidence is low, expose the available columns in the UI so the user can choose one.
- Extract non-empty values from the selected column.
- Generate stable local IDs for rows.
- Normalize names.
- Try to extract room codes.

Examples of room names/codes:

- `GF004 - GENERAL TEACHING AREA`
- `GF004`
- `G.004`
- `Room GF004`
- `S-06 Water Treatment Area`
- `S06 Water Treatment`

Normalize likely equivalent codes, for example:

- `GF004`
- `GF-004`
- `G.F.004`
- `G 004`

should be comparable.

## PDF Extraction

Implement `extractPdfText`.

Requirements:

- Use `pdfjs-dist`.
- For each page processed, call `page.getTextContent()`.
- For each text item:
  - ignore empty strings
  - capture text
  - capture page number
  - capture x/y/width/height
  - convert coordinates into the same coordinate system used by the rendered page preview
- Prefer PDF.js viewport transform utilities rather than hand-written y-axis flipping where possible.

Also implement `renderPdfPage` or equivalent so the viewer can render the PDF preview.

MVP can support only the first page, but structure the code so multi-page support can be added later.

## OCR Fallback

Implement `extractImageText`.

Requirements:

- Use `tesseract.js`.
- For image uploads, OCR the image.
- For PDF fallback, render the first page to a canvas/image and OCR that.
- Return the same `ExtractedTextItem[]` shape as PDF extraction.
- Mark source as `"ocr"`.

The OCR fallback can be basic for now.

## Text Grouping

Implement `groupTextItems`.

PDF and OCR output may split labels into separate chunks or words.

Group nearby text into candidate labels using simple explainable heuristics.

Use configurable constants such as:

```ts
const SAME_LINE_Y_TOLERANCE = 4;
const HORIZONTAL_GAP_TOLERANCE = 16;
const MULTI_LINE_VERTICAL_GAP_TOLERANCE = 24;
```

Rules:

- Sort by page, y, then x.
- Merge horizontally close items on roughly the same baseline.
- Optionally merge nearby vertical lines if they look like one room label block.
- Preserve child items.
- Avoid obviously over-merging large unrelated text areas.

## Matching

Implement `matchRooms`.

Use deterministic matching before any AI.

For each room, compare against label candidates using:

1. Exact normalized room-code match.
2. Code-like fuzzy match.
3. Exact normalized text containment.
4. Token overlap between room name and candidate text.
5. Fuzzy string similarity if simple to add.

Use explainable confidence scoring.

Suggested confidence bands:

- `0.95` = unique exact room code match
- `0.85` = exact code plus partial name match
- `0.75` = strong name/token match
- `0.60` = plausible fuzzy match
- `<0.60` = ambiguous or unmatched

If multiple candidates have similar confidence, mark the room as ambiguous.

If nothing passes a sensible threshold, mark it as unmatched.

Do not hallucinate missing rooms.

## UI

Create a simple UI with:

1. Upload panel:
   - floor plan upload
   - Excel upload
   - detected/selected room column
   - Process button
2. Floor plan viewer:
   - rendered PDF/image
   - overlay pins for matched rooms
   - pins should be draggable
   - clicking/hovering a pin should show room name, matched text, and confidence
3. Results table:
   - room name
   - matched text
   - page
   - x
   - y
   - confidence
   - status
   - reason
4. Debug panel:
   - extracted text items
   - grouped label candidates
   - match results
5. Export button:
   - downloads JSON containing:
     - floorPlanFileName
     - excelFileName
     - generatedAt
     - rooms
     - extractedCandidates

## Coordinate Handling

Be careful with coordinate systems.

The extracted coordinates must align with the rendered floor plan.

Store enough metadata to support display scaling, for example:

- `originalX`
- `originalY`
- `displayX`
- `displayY`
- `scale`

or normalized coordinates:

- `xPercent`
- `yPercent`

Pins should remain correctly positioned when the viewer resizes.

## Suggested Structure

Use this structure unless the existing project has a stronger convention:

```text
src/
  app/
    App.tsx
  components/
    FileUploadPanel.tsx
    FloorPlanViewer.tsx
    ResultsTable.tsx
    DebugPanel.tsx
  lib/
    pdf/
      extractPdfText.ts
      renderPdfPage.ts
    ocr/
      extractImageText.ts
    excel/
      parseRoomList.ts
    matching/
      normalize.ts
      groupTextItems.ts
      matchRooms.ts
    export/
      exportJson.ts
  types/
    floorPlan.ts
    rooms.ts
    matching.ts
```

Keep pure logic in `lib/` and UI in `components/`.

## Tests

Add small unit tests for:

- text normalization
- room-code extraction
- grouping
- matching confidence

Use simple mocked data. Do not rely on real PDFs/images in tests unless fixtures already exist.

## Implementation Order

Before coding, inspect the repo and create a short implementation plan.

Then implement incrementally in this order:

1. Basic app shell and file upload UI.
2. Excel parsing and room-column selection.
3. PDF rendering.
4. PDF text extraction with coordinates.
5. Image OCR fallback.
6. Text grouping.
7. Room matching.
8. Floor plan overlay pins.
9. Draggable correction.
10. Results/debug panels.
11. JSON export.
12. Unit tests.

## Acceptance Criteria

The work is complete when:

1. I can run the app locally.
2. I can upload a PDF floor plan.
3. I can upload an XLSX room list.
4. I can select or confirm the room-name column.
5. The app extracts room names from the Excel file.
6. The app attempts PDF text extraction first.
7. If the PDF has useful text, extracted text items appear in the debug panel with coordinates.
8. If the input is an image, OCR is used.
9. Extracted text is grouped into label candidates.
10. Rooms are matched to candidates with confidence and reasons.
11. Pins appear over the floor plan for matched rooms.
12. Pins can be dragged to correct positions.
13. The results table updates after correction.
14. Results can be exported as JSON.
15. The code is TypeScript-safe and avoids `any` unless absolutely unavoidable.
16. The implementation is simple enough to iterate on.
