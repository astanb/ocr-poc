const NON_ALPHANUMERIC = /[^a-z0-9]+/gi;
const ROOM_CODE_PATTERN =
  /\b(?:room\s+)?([A-Z]{1,3}(?:[\s.-]*[A-Z])?[\s.-]*\d{2,4}[A-Z]?|\d{1,3}[\s.-]*[A-Z]{1,3})\b/i;

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeRoomCode(value: string): string {
  return value.replace(NON_ALPHANUMERIC, "").toUpperCase();
}

export function extractRoomCode(value: string): string | undefined {
  const match = value.match(ROOM_CODE_PATTERN);
  if (!match?.[1]) {
    return undefined;
  }

  return normalizeRoomCode(match[1]);
}

export function tokenise(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1);
}
