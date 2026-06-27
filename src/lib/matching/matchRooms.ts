import { fuzzy } from "fast-fuzzy";
import type { ExtractedLabelCandidate, ExtractedTextItem } from "../../types/floorPlan";
import type { RoomMatch, RoomMatchAlternative } from "../../types/matching";
import type { RoomListItem } from "../../types/rooms";
import {
  extractRoomCodes,
  normalizeText,
  tokenise
} from "./normalize";

const MIN_MATCH_CONFIDENCE = 0.6;
const AMBIGUITY_GAP = 0.08;

type ScoredCandidate = RoomMatchAlternative & {
  candidate: ExtractedLabelCandidate;
  assignmentId: string;
};

type ScoredRoomCandidate = {
  room: RoomListItem;
  score: ScoredCandidate;
};

export function matchRooms(
  rooms: RoomListItem[],
  candidates: ExtractedLabelCandidate[]
): RoomMatch[] {
  const scoredByRoom = new Map(
    rooms.map((room) => [
      room.id,
      scoreRoomCandidates(room, candidates)
    ])
  );
  const assignedCandidateIds = new Set<string>();
  const selectedByRoomId = new Map<string, ScoredCandidate>();
  const allScores = rooms
    .flatMap((room): ScoredRoomCandidate[] =>
      (scoredByRoom.get(room.id) ?? []).map((score) => ({ room, score }))
    )
    .toSorted((left, right) => right.score.confidence - left.score.confidence);

  for (const { room, score } of allScores) {
    if (selectedByRoomId.has(room.id) || assignedCandidateIds.has(score.assignmentId)) {
      continue;
    }

    selectedByRoomId.set(room.id, score);
    assignedCandidateIds.add(score.assignmentId);
  }

  return rooms.map((room) =>
    matchRoom(
      room,
      selectedByRoomId.get(room.id),
      scoredByRoom.get(room.id) ?? []
    )
  );
}

function matchRoom(
  room: RoomListItem,
  best: ScoredCandidate | undefined,
  scored: ScoredCandidate[]
): RoomMatch {
  if (!best) {
    return createUnmatchedRoomMatch(room);
  }

  const alternatives = scored.map(toAlternative);
  const second = scored.find((score) => score.candidate.id !== best.candidate.id);
  const ambiguous =
    second !== undefined && best.confidence - second.confidence <= AMBIGUITY_GAP;

  return {
    roomId: room.id,
    roomRawName: room.rawName,
    matchedCandidateId: best.candidateId,
    matchedText: best.text,
    matchedSource: best.candidate.source,
    page: best.candidate.page,
    x: best.x,
    y: best.y,
    confidence: best.confidence,
    status: ambiguous ? "ambiguous" : "matched",
    reason: ambiguous
      ? "Multiple candidates scored similarly."
      : best.reason,
    alternatives
  };
}

function createUnmatchedRoomMatch(room: RoomListItem): RoomMatch {
  return {
    roomId: room.id,
    roomRawName: room.rawName,
    confidence: 0,
    status: "unmatched",
    reason: "No candidate reached the minimum confidence threshold."
  };
}

function scoreRoomCandidates(
  room: RoomListItem,
  candidates: ExtractedLabelCandidate[]
): ScoredCandidate[] {
  return candidates
    .map((candidate) => scoreCandidate(room, candidate))
    .filter((score) => score.confidence >= MIN_MATCH_CONFIDENCE)
    .toSorted((a, b) => b.confidence - a.confidence);
}

function scoreCandidate(
  room: RoomListItem,
  candidate: ExtractedLabelCandidate
): ScoredCandidate {
  const roomCode = room.possibleCode;
  const candidateCodes = extractRoomCodes(candidate.rawText);
  const candidateCode = candidateCodes[0];
  const roomTokens = tokenise(room.normalizedName);
  const candidateTokens = tokenise(candidate.normalizedText);
  const tokenOverlap = getTokenOverlap(roomTokens, candidateTokens);

  if (roomCode && candidateCodes.includes(roomCode)) {
    const localized = localizeCandidateForRoomCode(candidate, roomCode, roomTokens, candidateCodes);
    const descriptiveTokenOverlap = getDescriptiveTokenOverlap(
      roomTokens,
      candidateTokens,
      roomCode
    );
    const confidence =
      descriptiveTokenOverlap >= 0.75
        ? 0.98
        : descriptiveTokenOverlap >= 0.4 || tokenOverlap >= 0.4
          ? 0.95
          : 0.86;
    return {
      candidate,
      assignmentId: localized.assignmentId,
      candidateId: localized.assignmentId,
      text: localized.text,
      x: localized.x,
      y: localized.y,
      confidence,
      reason:
        confidence === 0.98
          ? "Exact room-code match with strong room-name support."
          : confidence === 0.95
            ? "Exact room-code match with partial room-name support."
            : "Exact room-code match without room-name support."
    };
  }

  if (roomCode && candidateCode && roomCode.replace(/^0+/, "") === candidateCode.replace(/^0+/, "")) {
    return scored(candidate, 0.72, "Code-like fuzzy match.");
  }

  if (hasConflictingRoomCode(roomCode, candidateCodes)) {
    return scored(candidate, 0, "Candidate contains a different room code.");
  }

  if (
    room.normalizedName.length > 0 &&
    candidate.normalizedText.includes(room.normalizedName)
  ) {
    return scored(candidate, 0.78, "Candidate text contains the normalized room name.");
  }

  if (tokenOverlap >= 0.7) {
    return scored(candidate, 0.75, "Strong room-name token overlap.");
  }

  if (tokenOverlap >= 0.45) {
    return scored(candidate, 0.62, "Plausible room-name token overlap.");
  }

  const canUseFuzzyNameMatch = !roomCode || Boolean(candidateCode);
  const fuzzyScore = canUseFuzzyNameMatch
    ? Math.max(
        fuzzy(room.normalizedName, candidate.normalizedText, FUZZY_OPTIONS),
        fuzzy(nameWithoutRoomCode(room), candidate.normalizedText, FUZZY_OPTIONS)
      )
    : 0;

  if (fuzzyScore >= 0.72) {
    return scored(candidate, 0.68, "Strong fuzzy room-name match.");
  }

  if (fuzzyScore >= 0.58) {
    return scored(candidate, 0.6, "Plausible fuzzy room-name match.");
  }

  return scored(candidate, 0, "No meaningful code or name similarity.");
}

const FUZZY_OPTIONS = {
  ignoreCase: true,
  ignoreSymbols: true,
  normalizeWhitespace: true
};

function getTokenOverlap(roomTokens: string[], candidateTokens: string[]): number {
  if (roomTokens.length === 0) {
    return 0;
  }

  const candidateSet = new Set(candidateTokens);
  const matched = roomTokens.filter((token) => candidateSet.has(token)).length;
  return matched / roomTokens.length;
}

function getDescriptiveTokenOverlap(
  roomTokens: string[],
  candidateTokens: string[],
  roomCode: string
): number {
  const code = roomCode.toLowerCase();
  const descriptiveTokens = roomTokens.filter((token) => token !== code);

  if (descriptiveTokens.length === 0) {
    return 0;
  }

  return getTokenOverlap(descriptiveTokens, candidateTokens);
}

function nameWithoutRoomCode(room: RoomListItem): string {
  if (!room.possibleCode) {
    return room.normalizedName;
  }

  const code = room.possibleCode.toLowerCase();
  return room.normalizedName
    .split(" ")
    .filter((token) => token !== code)
    .join(" ");
}

function hasConflictingRoomCode(
  roomCode: string | undefined,
  candidateCodes: string[]
): boolean {
  return Boolean(roomCode && candidateCodes.length > 0 && !candidateCodes.includes(roomCode));
}

function scored(
  candidate: ExtractedLabelCandidate,
  confidence: number,
  reason: string
): ScoredCandidate {
  return {
    candidate,
    assignmentId: candidate.id,
    candidateId: candidate.id,
    text: candidate.rawText,
    x: candidate.x + candidate.width / 2,
    y: candidate.y + candidate.height / 2,
    confidence,
    reason
  };
}

function localizeCandidateForRoomCode(
  candidate: ExtractedLabelCandidate,
  roomCode: string,
  roomTokens: string[],
  candidateCodes: string[]
): {
  assignmentId: string;
  text: string;
  x: number;
  y: number;
} {
  if (candidateCodes.length <= 1 || candidate.childItems.length === 0) {
    return {
      assignmentId: candidate.id,
      text: candidate.rawText,
      x: candidate.x + candidate.width / 2,
      y: candidate.y + candidate.height / 2
    };
  }

  const codeItem = candidate.childItems.find((item) =>
    extractRoomCodes(item.text).includes(roomCode)
  );
  if (!codeItem) {
    return {
      assignmentId: `${candidate.id}:${roomCode}`,
      text: candidate.rawText,
      x: candidate.x + candidate.width / 2,
      y: candidate.y + candidate.height / 2
    };
  }

  const descriptiveTokens = roomTokens.filter((token) => token !== roomCode.toLowerCase());
  const selectedItems = candidate.childItems.filter((item) =>
    item === codeItem ||
    (hasAnyToken(item.text, descriptiveTokens) && isNearSameLabelColumn(item, codeItem))
  );
  const localizedItems = selectedItems.length > 1 ? selectedItems : [codeItem];
  const bounds = getTextItemBounds(localizedItems);
  const text = localizedItems
    .toSorted(compareTextItemReadingOrder)
    .map((item) => item.text.trim())
    .join(" ");

  return {
    assignmentId: `${candidate.id}:${roomCode}`,
    text,
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  };
}

function hasAnyToken(text: string, tokens: string[]): boolean {
  const itemTokens = new Set(tokenise(normalizeText(text)));
  return tokens.some((token) => itemTokens.has(token));
}

function isNearSameLabelColumn(item: ExtractedTextItem, codeItem: ExtractedTextItem): boolean {
  const itemCenter = item.x + item.width / 2;
  const codeCenter = codeItem.x + codeItem.width / 2;
  return Math.abs(itemCenter - codeCenter) <= Math.max(item.width, codeItem.width);
}

function compareTextItemReadingOrder(
  left: ExtractedTextItem,
  right: ExtractedTextItem
): number {
  if (Math.abs(left.y - right.y) <= 4) {
    return left.x - right.x;
  }

  return left.y - right.y;
}

function getTextItemBounds(items: ExtractedTextItem[]) {
  const minX = Math.min(...items.map((item) => item.x));
  const minY = Math.min(...items.map((item) => item.y));
  const maxX = Math.max(...items.map((item) => item.x + item.width));
  const maxY = Math.max(...items.map((item) => item.y + item.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function toAlternative(score: ScoredCandidate): RoomMatchAlternative {
  return {
    candidateId: score.candidateId,
    text: score.text,
    source: score.candidate.source,
    x: score.x,
    y: score.y,
    confidence: score.confidence,
    reason: score.reason
  };
}
