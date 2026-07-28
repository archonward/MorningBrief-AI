import type { Article } from "../models/article.js";

export class ArticleRanker {
  public rank(articles: Article[], now: Date = new Date()): Article[] {
    return articles
      .map((article) => ({
        ...article,
        importanceScore: article.importanceScore ?? calculatePlaceholderScore(article, now)
      }))
      .sort((left, right) => {
        const scoreDifference =
          (right.importanceScore ?? 0) - (left.importanceScore ?? 0);

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        return right.publishedAt.getTime() - left.publishedAt.getTime();
      });
  }
}

function calculatePlaceholderScore(article: Article, now: Date): number {
  const credibility = article.credibilityScore ?? 0.5;
  const ageHours = Math.max(
    0,
    (now.getTime() - article.publishedAt.getTime()) / (60 * 60 * 1000)
  );
  const recency = Math.max(0, 1 - ageHours / 24);
  const titleSignal = Math.min(article.title.trim().length / 120, 1);

  return clampToScore(credibility * 0.45 + recency * 0.35 + titleSignal * 0.2);
}

function clampToScore(value: number): number {
  return Math.min(1, Math.max(0, Number(value.toFixed(4))));
}
