const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\""
};

const ansiEscapeSequence =
  /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g;
const unsafeControlCharacters =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

export function cleanRssText(
  value: string | undefined,
  maxLength?: number
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const withoutControls = value
    .replace(ansiEscapeSequence, "")
    .replace(unsafeControlCharacters, "");
  const withoutTags = withoutControls.replace(/<[^>]*>/g, " ");
  const decoded = withoutTags.replace(
    /&(#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/g,
    (entity, body: string) => decodeEntity(entity, body)
  );
  const cleaned = decoded.replace(/\s+/g, " ").trim();
  const limited =
    maxLength === undefined ? cleaned : truncateWithoutSplittingSurrogate(cleaned, maxLength);

  return limited.length > 0 ? limited : undefined;
}

function decodeEntity(entity: string, body: string): string {
  if (body.startsWith("#x")) {
    return decodeCodePoint(entity, Number.parseInt(body.slice(2), 16));
  }

  if (body.startsWith("#")) {
    return decodeCodePoint(entity, Number.parseInt(body.slice(1), 10));
  }

  return namedEntities[body] ?? entity;
}

function decodeCodePoint(fallback: string, codePoint: number): string {
  if (!Number.isFinite(codePoint)) {
    return fallback;
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

function truncateWithoutSplittingSurrogate(value: string, maxLength: number): string {
  if (!Number.isInteger(maxLength) || maxLength < 1) {
    throw new Error("maxLength must be a positive integer");
  }

  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength);
  const finalCodeUnit = truncated.charCodeAt(truncated.length - 1);

  return finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff
    ? truncated.slice(0, -1)
    : truncated;
}
