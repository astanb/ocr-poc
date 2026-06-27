import type {
  ExtractedLabelCandidate,
  ExtractedTextItem
} from "../../types/floorPlan";
import type { RoomMatch } from "../../types/matching";
import type { RoomListItem } from "../../types/rooms";
import { groupTextItems } from "../matching/groupTextItems";
import { matchRooms } from "../matching/matchRooms";
import {
  dedupeOcrTextItems,
  mapTileTextItemsToPage,
  type OcrTile
} from "./ocrTiling";

export type OcrEngine<TImage = File | Blob | HTMLCanvasElement | string> = {
  id: string;
  label: string;
  extractText: (image: TImage) => Promise<ExtractedTextItem[]>;
  consumeSetupDurationMs?: () => number | undefined;
};

export type OcrPipelineProgress = {
  engineId: string;
  engineLabel: string;
  passId?: string;
  passLabel?: string;
  tileMode?: "full-page" | "tiled";
  tileIndex?: number;
  tileCount?: number;
  status: "started" | "completed" | "failed";
  message: string;
};

export type OcrAttempt = {
  engineId: string;
  engineLabel: string;
  passId?: string;
  passLabel?: string;
  tileMode?: "full-page" | "tiled";
  tileCount?: number;
  setupDurationMs?: number;
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
  engines,
  passes,
  onProgress
}: {
  image: TImage;
  rooms: RoomListItem[];
  engines: OcrEngine<TImage>[];
  passes?: Array<{
    id: string;
    label: string;
    image: TImage;
    tiledImages?: Array<OcrTile & {
      label: string;
      image: TImage;
    }>;
  }>;
  onProgress?: (progress: OcrPipelineProgress) => void;
}): Promise<OcrMatchPipelineResult> {
  const attempts: OcrAttempt[] = [];
  const inputs = passes ?? [{ id: undefined, label: undefined, image, tiledImages: undefined }];

  for (const engine of engines) {
    for (const input of inputs) {
      attempts.push(await runAttempt({
        engine,
        image: input.image,
        rooms,
        passId: input.id,
        passLabel: input.label,
        tileMode: input.id ? "full-page" : undefined,
        onProgress
      }));

      if (input.tiledImages && input.tiledImages.length > 1) {
        attempts.push(await runTiledAttempt({
          engine,
          rooms,
          passId: input.id,
          passLabel: input.label,
          tiles: input.tiledImages,
          onProgress
        }));
      }
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

async function runAttempt<TImage>({
  engine,
  image,
  rooms,
  passId,
  passLabel,
  tileMode,
  onProgress
}: {
  engine: OcrEngine<TImage>;
  image: TImage;
  rooms: RoomListItem[];
  passId?: string;
  passLabel?: string;
  tileMode?: "full-page" | "tiled";
  onProgress?: (progress: OcrPipelineProgress) => void;
}): Promise<OcrAttempt> {
  const startedAt = now();
  emitProgress(onProgress, {
    engine,
    passId,
    passLabel,
    tileMode,
    status: "started"
  });
  try {
    const textItems = await engine.extractText(image);
    const totalDurationMs = now() - startedAt;
    const setupDurationMs = engine.consumeSetupDurationMs?.();
    const attempt = createAttempt({
      engine,
      rooms,
      passId,
      passLabel,
      tileMode,
      durationMs: getOcrDurationMs(totalDurationMs, setupDurationMs),
      setupDurationMs,
      textItems
    });
    emitProgress(onProgress, {
      engine,
      passId,
      passLabel,
      tileMode,
      status: "completed"
    });
    return attempt;
  } catch (error: unknown) {
    emitProgress(onProgress, {
      engine,
      passId,
      passLabel,
      tileMode,
      status: "failed"
    });
    return createFailedAttempt({
      engine,
      rooms,
      passId,
      passLabel,
      tileMode,
      durationMs: now() - startedAt,
      error
    });
  }
}

async function runTiledAttempt<TImage>({
  engine,
  rooms,
  passId,
  passLabel,
  tiles,
  onProgress
}: {
  engine: OcrEngine<TImage>;
  rooms: RoomListItem[];
  passId?: string;
  passLabel?: string;
  tiles: Array<OcrTile & {
    label: string;
    image: TImage;
  }>;
  onProgress?: (progress: OcrPipelineProgress) => void;
}): Promise<OcrAttempt> {
  const startedAt = now();
  try {
    const tileItems = [];

    for (const [index, tile] of tiles.entries()) {
      emitProgress(onProgress, {
        engine,
        passId,
        passLabel,
        tileMode: "tiled",
        tileIndex: index + 1,
        tileCount: tiles.length,
        status: "started"
      });
      try {
        const items = await engine.extractText(tile.image);
        tileItems.push(...mapTileTextItemsToPage(items, tile));
        emitProgress(onProgress, {
          engine,
          passId,
          passLabel,
          tileMode: "tiled",
          tileIndex: index + 1,
          tileCount: tiles.length,
          status: "completed"
        });
      } catch (error) {
        emitProgress(onProgress, {
          engine,
          passId,
          passLabel,
          tileMode: "tiled",
          tileIndex: index + 1,
          tileCount: tiles.length,
          status: "failed"
        });
        throw error;
      }
    }

    const totalDurationMs = now() - startedAt;
    const setupDurationMs = engine.consumeSetupDurationMs?.();
    return createAttempt({
      engine,
      rooms,
      passId,
      passLabel,
      tileMode: "tiled",
      tileCount: tiles.length,
      durationMs: getOcrDurationMs(totalDurationMs, setupDurationMs),
      setupDurationMs,
      textItems: dedupeOcrTextItems(tileItems)
    });
  } catch (error: unknown) {
    return createFailedAttempt({
      engine,
      rooms,
      passId,
      passLabel,
      tileMode: "tiled",
      tileCount: tiles.length,
      durationMs: now() - startedAt,
      error
    });
  }
}

function emitProgress<TImage>(
  onProgress: ((progress: OcrPipelineProgress) => void) | undefined,
  {
    engine,
    passId,
    passLabel,
    tileMode,
    tileIndex,
    tileCount,
    status
  }: {
    engine: OcrEngine<TImage>;
    passId?: string;
    passLabel?: string;
    tileMode?: "full-page" | "tiled";
    tileIndex?: number;
    tileCount?: number;
    status: OcrPipelineProgress["status"];
  }
) {
  if (!onProgress) {
    return;
  }

  const parts = [
    engine.label,
    passLabel,
    tileMode === "tiled" && tileIndex && tileCount
      ? `tile ${tileIndex}/${tileCount}`
      : tileMode === "full-page"
        ? "full page"
        : undefined
  ].filter(Boolean);

  onProgress({
    engineId: engine.id,
    engineLabel: engine.label,
    passId,
    passLabel,
    tileMode,
    tileIndex,
    tileCount,
    status,
    message: `${status}: ${parts.join(" / ")}`
  });
}

function createAttempt<TImage>({
  engine,
  rooms,
  passId,
  passLabel,
  tileMode,
  tileCount,
  durationMs,
  setupDurationMs,
  textItems
}: {
  engine: OcrEngine<TImage>;
  rooms: RoomListItem[];
  passId?: string;
  passLabel?: string;
  tileMode?: "full-page" | "tiled";
  tileCount?: number;
  durationMs: number;
  setupDurationMs?: number;
  textItems: ExtractedTextItem[];
}): OcrAttempt {
  const candidates = groupTextItems(textItems);
  const matches = matchRooms(rooms, candidates);

  return {
    engineId: engine.id,
    engineLabel: engine.label,
    passId,
    passLabel,
    tileMode,
    tileCount,
    setupDurationMs,
    durationMs,
    textItems,
    candidates,
    matches,
    stats: summarizeMatches(matches)
  };
}

function createFailedAttempt<TImage>({
  engine,
  rooms,
  passId,
  passLabel,
  tileMode,
  tileCount,
  durationMs,
  error
}: {
  engine: OcrEngine<TImage>;
  rooms: RoomListItem[];
  passId?: string;
  passLabel?: string;
  tileMode?: "full-page" | "tiled";
  tileCount?: number;
  durationMs: number;
  error: unknown;
}): OcrAttempt {
  const matches = rooms.map((room): RoomMatch => ({
    roomId: room.id,
    roomRawName: room.rawName,
    confidence: 0,
    status: "unmatched",
    reason: "OCR engine failed."
  }));

  return {
    engineId: engine.id,
    engineLabel: engine.label,
    passId,
    passLabel,
    tileMode,
    tileCount,
    durationMs,
    textItems: [],
    candidates: [],
    matches,
    stats: summarizeMatches(matches),
    errorMessage: error instanceof Error ? error.message : String(error)
  };
}

function chooseBestAttempt(attempts: OcrAttempt[]): OcrAttempt | undefined {
  return attempts
    .slice()
    .sort((left, right) => scoreAttempt(right) - scoreAttempt(left))[0];
}

function mergeBestRoomMatches(rooms: RoomListItem[], attempts: OcrAttempt[]): RoomMatch[] {
  const selectedByRoomId = new Map<string, RoomMatch>();
  const usedPinKeys = new Set<string>();
  const allMatches = rooms
    .flatMap((room) =>
      attempts
        .map((attempt) => attempt.matches.find((match) => match.roomId === room.id))
        .filter((match): match is RoomMatch => Boolean(match))
    )
    .toSorted((left, right) => scoreMatch(right) - scoreMatch(left));

  for (const match of allMatches) {
    if (selectedByRoomId.has(match.roomId)) {
      continue;
    }

    const pinKey = getPinKey(match);
    if (pinKey && usedPinKeys.has(pinKey)) {
      continue;
    }

    selectedByRoomId.set(match.roomId, match);
    if (pinKey) {
      usedPinKeys.add(pinKey);
    }
  }

  return rooms.map((room) =>
    selectedByRoomId.get(room.id) ?? createUnmatchedMergedMatch(room)
  );
}

function createUnmatchedMergedMatch(room: RoomListItem): RoomMatch {
  return {
    roomId: room.id,
    roomRawName: room.rawName,
    confidence: 0,
    status: "unmatched",
    reason: "No non-overlapping candidate reached the minimum confidence threshold."
  };
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

function getPinKey(match: RoomMatch): string | undefined {
  if (typeof match.x !== "number" || typeof match.y !== "number") {
    return undefined;
  }

  const page = match.page ?? 1;
  return `${page}:${Math.round(match.x)}:${Math.round(match.y)}`;
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

function getOcrDurationMs(totalDurationMs: number, setupDurationMs?: number): number {
  return Math.max(0, totalDurationMs - (setupDurationMs ?? 0));
}
