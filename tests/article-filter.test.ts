import { describe, expect, it } from "vitest";
import type { Article } from "../src/models/article.js";
import { ArticleFilter } from "../src/services/article-filter.js";

describe("ArticleFilter", () => {
  const startTime = new Date("2026-07-27T22:00:00.000Z");
  const endTime = new Date("2026-07-28T08:00:00.000Z");

  it("removes articles outside the time window", async () => {
    const filter = new ArticleFilter();
    const articles = [
      makeArticle({ id: "old", publishedAt: new Date("2026-07-27T12:00:00.000Z") }),
      makeArticle({ id: "valid", publishedAt: new Date("2026-07-28T01:00:00.000Z") })
    ];

    const result = await filter.filter(articles, startTime, endTime);

    expect(result.map((article) => article.id)).toEqual(["valid"]);
  });

  it("removes articles with missing titles", async () => {
    const filter = new ArticleFilter();
    const articles = [
      makeArticle({ id: "missing-title", title: "   " }),
      makeArticle({ id: "valid", title: "Valid headline" })
    ];

    const result = await filter.filter(articles, startTime, endTime);

    expect(result.map((article) => article.id)).toEqual(["valid"]);
  });

  it("removes duplicate URLs", async () => {
    const filter = new ArticleFilter();
    const articles = [
      makeArticle({ id: "first", url: "https://example.com/story" }),
      makeArticle({ id: "duplicate", url: "https://example.com/story" }),
      makeArticle({ id: "other", url: "https://example.com/other-story" })
    ];

    const result = await filter.filter(articles, startTime, endTime);

    expect(result.map((article) => article.id)).toEqual(["first", "other"]);
  });

  it("keeps valid articles", async () => {
    const filter = new ArticleFilter();
    const article = makeArticle({ id: "valid" });

    const result = await filter.filter([article], startTime, endTime);

    expect(result).toEqual([article]);
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
