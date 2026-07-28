import { describe, expect, it } from "vitest";
import type { Article } from "../src/models/article.js";
import { ArticleRanker } from "../src/services/article-ranker.js";

describe("ArticleRanker", () => {
  it("returns articles in descending score order", () => {
    const ranker = new ArticleRanker();
    const articles = [
      makeArticle({ id: "low", importanceScore: 0.2 }),
      makeArticle({ id: "high", importanceScore: 0.9 }),
      makeArticle({ id: "middle", importanceScore: 0.6 })
    ];

    const result = ranker.rank(articles);

    expect(result.map((article) => article.id)).toEqual(["high", "middle", "low"]);
  });

  it("preserves the original article data", () => {
    const ranker = new ArticleRanker();
    const article = makeArticle({
      id: "story",
      title: "Original title",
      content: "Original article content"
    });

    const result = ranker.rank([article]);

    expect(result[0]).toMatchObject({
      id: "story",
      title: "Original title",
      content: "Original article content",
      url: article.url,
      source: article.source
    });
  });

  it("handles an empty array", () => {
    const ranker = new ArticleRanker();

    expect(ranker.rank([])).toEqual([]);
  });
});

function makeArticle(overrides: Partial<Article>): Article {
  return {
    id: "article-1",
    title: "Example headline",
    url: "https://example.com/article-1",
    source: "Example News",
    publishedAt: new Date("2026-07-28T01:00:00.000Z"),
    description: "Example description",
    content: "Example content",
    category: "world",
    credibilityScore: 0.8,
    importanceScore: 0.5,
    ...overrides
  };
}
