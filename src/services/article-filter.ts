import type { Article } from "../models/article.js";
import type { ArticleRepository } from "../repositories/article-repository.js";
import { normaliseArticleUrl } from "../utils/url-normaliser.js";

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

      const normalizedUrl = normaliseArticleUrl(article.url);
      if (!normalizedUrl) {
        continue;
      }

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
