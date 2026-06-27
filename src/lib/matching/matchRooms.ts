import { fuzzy } from "fast-fuzzy";
import type { ExtractedLabelCandidate } from "../../types/floorPlan";
import type { RoomMatch, RoomMatchAlternative } from "../../types/matching";
import type { RoomListItem } from "../../types/rooms";
import { extractRoomCode, normalizeRoomCode, tokenise } from "./normalize";

const MIN_MATCH_CONFIDENCE = 0.6;
const AMBIGUITY_GAP = 0.08;

type ScoredCandidate = RoomMatchAlternative & {
  candidate: ExtractedLabelCandidate;
};

export function matchRooms(
  rooms: RoomListItem[],
  candidates: ExtractedLabelCandidate[]
): RoomMatch[] {
  return rooms.map((room) => matchRoom(room, candidates));
}

function matchRoom(
  room: RoomListItem,
  candidates: ExtractedLabelCandidate[]
): RoomMatch {
  const scored = candidates
    .map((candidate) => scoreCandidate(room, candidate))
    .filter((score) => score.confidence >= MIN_MATCH_CONFIDENCE)
    .toSorted((a, b) => b.confidence - a.confidence);

  const best = scored[0];
  if (!best) {
    return {
      roomId: room.id,
      roomRawName: room.rawName,
      confidence: 0,
      status: "unmatched",
      reason: "No candidate reached the minimum confidence threshold."
    };
  }

  const alternatives = scored.map(toAlternative);
  const second = scored[1];
  const ambiguous =
    Boolean(second) && best.confidence - second.confidence <= AMBIGUITY_GAP;

  return {
    roomId: room.id,
    roomRawName: room.rawName,
    matchedCandidateId: best.candidate.id,
    matchedText: best.candidate.rawText,
    page: best.candidate.page,
    x: best.candidate.x + best.candidate.width / 2,
    y: best.candidate.y + best.candidate.height / 2,
    confidence: best.confidence,
    status: ambiguous ? "ambiguous" : "matched",
    reason: ambiguous
      ? "Multiple candidates scored similarly."
      : best.reason,
    alternatives
  };
}

function scoreCandidate(
  room: RoomListItem,
  candidate: ExtractedLabelCandidate
): ScoredCandidate {
  const roomCode = room.possibleCode;
  const candidateCode = extractRoomCode(candidate.rawText);
  const roomTokens = tokenise(room.normalizedName);
  const candidateTokens = tokenise(candidate.normalizedText);
  const tokenOverlap = getTokenOverlap(roomTokens, candidateTokens);

  if (roomCode && candidateCode && roomCode === normalizeRoomCode(candidateCode)) {
    const confidence = tokenOverlap >= 0.4 ? 0.95 : 0.9;
    return {
      candidate,
      candidateId: candidate.id,
      text: candidate.rawText,
      x: candidate.x,
      y: candidate.y,
      confidence,
      reason:
        confidence === 0.95
          ? "Unique exact room-code match with supporting name overlap."
          : "Exact room-code match."
    };
  }

  if (roomCode && candidateCode && roomCode.replace(/^0+/, "") === candidateCode.replace(/^0+/, "")) {
    return scored(candidate, 0.72, "Code-like fuzzy match.");
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

function scored(
  candidate: ExtractedLabelCandidate,
  confidence: number,
  reason: string
): ScoredCandidate {
  return {
    candidate,
    candidateId: candidate.id,
    text: candidate.rawText,
    x: candidate.x,
    y: candidate.y,
    confidence,
    reason
  };
}

function toAlternative(score: ScoredCandidate): RoomMatchAlternative {
  return {
    candidateId: score.candidateId,
    text: score.text,
    x: score.x,
    y: score.y,
    confidence: score.confidence,
    reason: score.reason
  };
}
