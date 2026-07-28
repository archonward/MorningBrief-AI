const trackingParameters = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "at_campaign",
  "at_medium",
  "fbclid",
  "gclid"
]);

export function normaliseArticleUrl(value: string): string | null {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.hash = "";

    const removableKeys = Array.from(url.searchParams.keys()).filter((key) =>
      trackingParameters.has(key.toLowerCase())
    );

    for (const key of removableKeys) {
      url.searchParams.delete(key);
    }

    return url.toString();
  } catch {
    return null;
  }
}
