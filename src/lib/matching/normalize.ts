const NON_ALPHANUMERIC = /[^a-z0-9]+/gi;
const ROOM_CODE_GLOBAL_PATTERN =
  /\b(?:room\s+)?([A-Z]{1,4}[\s.-]*(?=[0-9OIL]*\d)[0-9OIL]{1,4}[A-Z]?|\d{1,3}[\s.-]*[A-Z]{1,3})\b/gi;

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeRoomCode(value: string): string {
  const compact = value.replace(NON_ALPHANUMERIC, "").toUpperCase();
  const match = compact.match(/^([A-Z]+)([0-9OIL]+)([A-Z]?)$/);
  if (!match) {
    return compact;
  }

  let prefix = match[1];
  let digits = match[2];
  while (prefix.length > 2 && /[OIL]$/u.test(prefix) && digits.length < 4) {
    prefix = prefix.slice(0, -1);
    digits = `${match[1].at(prefix.length)}${digits}`;
  }

  return `${prefix}${digits.replaceAll("O", "0").replaceAll("I", "1").replaceAll("L", "1")}${match[3]}`;
}

export function extractRoomCode(value: string): string | undefined {
  return extractRoomCodes(value)[0];
}

export function extractRoomCodes(value: string): string[] {
  return [...value.matchAll(ROOM_CODE_GLOBAL_PATTERN)].reduce<string[]>((codes, match) => {
    if (!match[1] || isMeasurementFragment(value, match)) {
      return codes;
    }

    const code = normalizeRoomCode(match[1]);
    return codes.includes(code) ? codes : [...codes, code];
  }, []);
}

function isMeasurementFragment(value: string, match: RegExpMatchArray): boolean {
  const end = (match.index ?? 0) + match[0].length;
  const tail = value.slice(end);
  return /^\.\d+\s*m(?:2|²)?\b/iu.test(tail);
}

export function tokenise(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1);
}
