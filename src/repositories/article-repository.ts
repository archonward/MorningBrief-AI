import type { Article } from "../models/article.js";

export interface ArticleRepository {
  hasProcessedUrl(url: string): Promise<boolean>;
  saveProcessedArticle(article: Article): Promise<void>;
  getRecentProcessedUrls(limit?: number): Promise<string[]>;
}

export class InMemoryArticleRepository implements ArticleRepository {
  private readonly processedByUrl = new Map<string, Article>();

  public async hasProcessedUrl(url: string): Promise<boolean> {
    return this.processedByUrl.has(normalizeUrl(url));
  }

  public async saveProcessedArticle(article: Article): Promise<void> {
    this.processedByUrl.set(normalizeUrl(article.url), article);
  }

  public async getRecentProcessedUrls(limit = 100): Promise<string[]> {
    return Array.from(this.processedByUrl.keys()).slice(-limit);
  }
}

function normalizeUrl(url: string): string {
  return url.trim().toLowerCase();
}
