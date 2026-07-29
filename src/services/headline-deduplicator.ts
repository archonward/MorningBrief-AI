import type { Article } from "../models/article.js";

export class HeadlineDeduplicator {
  public deduplicate(rankedArticles: Article[]): Article[] {
    const seenFingerprints = new Set<string>();

    return rankedArticles.filter((article) => {
      const fingerprint = createHeadlineFingerprint(article.title);

      // A punctuation-only headline should not suppress unrelated articles.
      if (!fingerprint) {
        return true;
      }

      if (seenFingerprints.has(fingerprint)) {
        return false;
      }

      seenFingerprints.add(fingerprint);
      return true;
    });
  }
}

export function createHeadlineFingerprint(title: string): string {
  return title
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
