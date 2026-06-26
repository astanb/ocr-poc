import type { ExtractedLabelCandidate } from "../../types/floorPlan";
import type { RoomMatch } from "../../types/matching";

export type ExportPayload = {
  floorPlanFileName?: string;
  excelFileName?: string;
  generatedAt: string;
  rooms: RoomMatch[];
  extractedCandidates: ExtractedLabelCandidate[];
};

export function createExportPayload(input: {
  floorPlanFileName?: string;
  excelFileName?: string;
  rooms: RoomMatch[];
  extractedCandidates: ExtractedLabelCandidate[];
  generatedAt?: Date;
}): ExportPayload {
  return {
    floorPlanFileName: input.floorPlanFileName,
    excelFileName: input.excelFileName,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    rooms: input.rooms,
    extractedCandidates: input.extractedCandidates
  };
}

export function downloadJson(payload: ExportPayload, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
