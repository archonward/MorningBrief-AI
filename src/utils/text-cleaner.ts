const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\""
};

export function cleanRssText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const withoutTags = value.replace(/<[^>]*>/g, " ");
  const decoded = withoutTags.replace(
    /&(#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/g,
    (entity, body: string) => decodeEntity(entity, body)
  );
  const cleaned = decoded.replace(/\s+/g, " ").trim();

  return cleaned.length > 0 ? cleaned : undefined;
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
