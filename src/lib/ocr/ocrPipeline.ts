import type {
  ExtractedLabelCandidate,
  ExtractedTextItem
} from "../../types/floorPlan";
import type { RoomMatch } from "../../types/matching";
import type { RoomListItem } from "../../types/rooms";
import { groupTextItems } from "../matching/groupTextItems";
import { matchRooms } from "../matching/matchRooms";

export type OcrEngine<TImage = File | Blob | HTMLCanvasElement | string> = {
  id: string;
  label: string;
  extractText: (image: TImage) => Promise<ExtractedTextItem[]>;
};

export type OcrAttempt = {
  engineId: string;
  engineLabel: string;
  durationMs: number;
  textItems: ExtractedTextItem[];
  candidates: ExtractedLabelCandidate[];
  matches: RoomMatch[];
  stats: MatchStats;
  errorMessage?: string;
};

export type MatchStats = {
  matched: number;
  ambiguous: number;
  unmatched: number;
};

export type OcrMatchPipelineResult = {
  attempts: OcrAttempt[];
  bestAttempt?: OcrAttempt;
  textItems: ExtractedTextItem[];
  candidates: ExtractedLabelCandidate[];
  matches: RoomMatch[];
  stats: MatchStats;
};

export async function runOcrMatchPipeline<TImage>({
  image,
  rooms,
  engines
}: {
  image: TImage;
  rooms: RoomListItem[];
  engines: OcrEngine<TImage>[];
}): Promise<OcrMatchPipelineResult> {
  const attempts: OcrAttempt[] = [];

  for (const engine of engines) {
    const startedAt = now();
    try {
      const textItems = await engine.extractText(image);
      const candidates = groupTextItems(textItems);
      const matches = matchRooms(rooms, candidates);

      attempts.push({
        engineId: engine.id,
        engineLabel: engine.label,
        durationMs: now() - startedAt,
        textItems,
        candidates,
        matches,
        stats: summarizeMatches(matches)
      });
    } catch (error: unknown) {
      const matches = rooms.map((room): RoomMatch => ({
        roomId: room.id,
        roomRawName: room.rawName,
        confidence: 0,
        status: "unmatched",
        reason: "OCR engine failed."
      }));

      attempts.push({
        engineId: engine.id,
        engineLabel: engine.label,
        durationMs: now() - startedAt,
        textItems: [],
        candidates: [],
        matches,
        stats: summarizeMatches(matches),
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const bestAttempt = chooseBestAttempt(attempts);
  const matches = mergeBestRoomMatches(rooms, attempts);

  return {
    attempts,
    bestAttempt,
    textItems: attempts.flatMap((attempt) => attempt.textItems),
    candidates: attempts.flatMap((attempt) => attempt.candidates),
    matches,
    stats: summarizeMatches(matches)
  };
}

function chooseBestAttempt(attempts: OcrAttempt[]): OcrAttempt | undefined {
  return attempts
    .slice()
    .sort((left, right) => scoreAttempt(right) - scoreAttempt(left))[0];
}

function mergeBestRoomMatches(rooms: RoomListItem[], attempts: OcrAttempt[]): RoomMatch[] {
  return rooms.map((room) => {
    const roomMatches = attempts
      .map((attempt) => attempt.matches.find((match) => match.roomId === room.id))
      .filter((match): match is RoomMatch => Boolean(match));

    return roomMatches
      .slice()
      .sort((left, right) => scoreMatch(right) - scoreMatch(left))[0];
  });
}

function summarizeMatches(matches: RoomMatch[]): MatchStats {
  return matches.reduce(
    (stats, match) => {
      stats[match.status === "ambiguous" ? "ambiguous" : match.status === "unmatched" ? "unmatched" : "matched"] += 1;
      return stats;
    },
    { matched: 0, ambiguous: 0, unmatched: 0 }
  );
}

function scoreAttempt(attempt: OcrAttempt): number {
  return attempt.stats.matched * 1_000_000 +
    attempt.stats.ambiguous * 1_000 +
    averageConfidence(attempt.matches);
}

function scoreMatch(match: RoomMatch): number {
  if (match.status === "matched" || match.status === "corrected") {
    return 2 + match.confidence;
  }

  if (match.status === "ambiguous") {
    return 1 + match.confidence;
  }

  return match.confidence;
}

function averageConfidence(matches: RoomMatch[]): number {
  if (matches.length === 0) {
    return 0;
  }

  return matches.reduce((sum, match) => sum + match.confidence, 0) / matches.length;
}

function now(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}
