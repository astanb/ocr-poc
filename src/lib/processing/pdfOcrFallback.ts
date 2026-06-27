import type { RoomMatch } from "../../types/matching";
import type { RoomListItem } from "../../types/rooms";

export const PDF_OCR_RETRY_CONFIDENCE_THRESHOLD = 0.9;

export function getRoomsNeedingOcrRetry(
  rooms: RoomListItem[],
  pdfMatches: RoomMatch[],
  threshold = PDF_OCR_RETRY_CONFIDENCE_THRESHOLD
): RoomListItem[] {
  const matchByRoomId = new Map(pdfMatches.map((match) => [match.roomId, match]));

  return rooms.filter((room) => {
    const match = matchByRoomId.get(room.id);
    return !match || match.confidence < threshold;
  });
}

export function mergePdfMatchesWithOcrRetries(
  pdfMatches: RoomMatch[],
  ocrRetryMatches: RoomMatch[],
  threshold = PDF_OCR_RETRY_CONFIDENCE_THRESHOLD
): RoomMatch[] {
  const ocrByRoomId = new Map(ocrRetryMatches.map((match) => [match.roomId, match]));

  return pdfMatches.map((pdfMatch) => {
    if (pdfMatch.confidence >= threshold) {
      return pdfMatch;
    }

    const ocrMatch = ocrByRoomId.get(pdfMatch.roomId);
    if (!ocrMatch || ocrMatch.confidence <= pdfMatch.confidence) {
      return pdfMatch;
    }

    return {
      ...ocrMatch,
      reason: `${ocrMatch.reason} OCR retry replaced a lower-confidence PDF text match.`
    };
  });
}
