import { describe, expect, it } from "vitest";
import { ArticleSchema } from "../src/models/article.js";
import { MorningBriefingSchema } from "../src/models/briefing.js";

describe("model schemas", () => {
  it("rejects a whitespace-only article title", () => {
    const result = ArticleSchema.safeParse({
      id: "article-1",
      title: "   ",
      url: "https://example.com/story",
      source: "Example News",
      publishedAt: new Date()
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-HTTP article URLs", () => {
    const result = ArticleSchema.safeParse({
      id: "article-1",
      title: "Headline",
      url: "ftp://example.com/story",
      source: "Example News",
      publishedAt: new Date()
    });

    expect(result.success).toBe(false);
  });

  it("reports an invalid article URL without throwing from safeParse", () => {
    expect(() =>
      ArticleSchema.safeParse({
        id: "article-1",
        title: "Headline",
        url: "not a URL",
        source: "Example News",
        publishedAt: new Date()
      })
    ).not.toThrow();
  });

  it("rejects a briefing whose window is reversed", () => {
    const result = MorningBriefingSchema.safeParse({
      generatedAt: new Date("2026-07-28T08:00:00.000Z"),
      timeWindowStart: new Date("2026-07-28T08:00:00.000Z"),
      timeWindowEnd: new Date("2026-07-27T22:00:00.000Z"),
      items: []
    });

    expect(result.success).toBe(false);
  });
});
