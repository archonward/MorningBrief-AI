import type { Article } from "../models/article.js";
import type { ArticleRepository } from "../repositories/article-repository.js";

export class ArticleFilter {
  public constructor(private readonly repository?: ArticleRepository) {}

  public async filter(
    articles: Article[],
    startTime: Date,
    endTime: Date
  ): Promise<Article[]> {
    const seenUrls = new Set<string>();
    const filtered: Article[] = [];

    for (const article of articles) {
      if (!isWithinWindow(article.publishedAt, startTime, endTime)) {
        continue;
      }

      if (article.title.trim().length === 0) {
        continue;
      }

      if (!isValidUrl(article.url)) {
        continue;
      }

      const normalizedUrl = normalizeUrl(article.url);
      if (seenUrls.has(normalizedUrl)) {
        continue;
      }

      if (this.repository && (await this.repository.hasProcessedUrl(article.url))) {
        continue;
      }

      seenUrls.add(normalizedUrl);
      filtered.push(article);
    }

    return filtered;
  }
}

function isWithinWindow(value: Date, startTime: Date, endTime: Date): boolean {
  return value >= startTime && value <= endTime;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  return url.trim().toLowerCase();
}
