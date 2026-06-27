export type MatchStatus = "matched" | "ambiguous" | "unmatched" | "corrected";

export type RoomMatchAlternative = {
  candidateId: string;
  text: string;
  source?: string;
  x: number;
  y: number;
  confidence: number;
  reason: string;
};

export type RoomMatch = {
  roomId: string;
  roomRawName: string;
  matchedCandidateId?: string;
  matchedText?: string;
  matchedSource?: string;
  page?: number;
  x?: number;
  y?: number;
  confidence: number;
  status: MatchStatus;
  reason: string;
  alternatives?: RoomMatchAlternative[];
};
