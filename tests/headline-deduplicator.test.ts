import { describe, expect, it } from "vitest";
import type { Article } from "../src/models/article.js";
import {
  HeadlineDeduplicator,
  createHeadlineFingerprint
} from "../src/services/headline-deduplicator.js";

describe("HeadlineDeduplicator", () => {
  it("keeps the first ranked article when different URLs have matching headlines", () => {
    const deduplicator = new HeadlineDeduplicator();
    const highestRanked = makeArticle({
      id: "highest",
      source: "Publisher One",
      url: "https://one.example/story",
      importanceScore: 0.9
    });
    const duplicate = makeArticle({
      id: "duplicate",
      source: "Publisher Two",
      url: "https://two.example/report",
      importanceScore: 0.8
    });

    expect(deduplicator.deduplicate([highestRanked, duplicate])).toEqual([
      highestRanked
    ]);
  });

  it("matches case, Unicode, punctuation, and whitespace variations", () => {
    const deduplicator = new HeadlineDeduplicator();
    const articles = [
      makeArticle({
        id: "first",
        title: "Markets’ “Sharp” Turn: What Happened?"
      }),
      makeArticle({
        id: "duplicate",
        title: "  MARKETS'  \"sharp\" turn — what happened! "
      })
    ];

    expect(deduplicator.deduplicate(articles).map(({ id }) => id)).toEqual([
      "first"
    ]);
  });

  it("keeps differently worded reports of the same event", () => {
    const deduplicator = new HeadlineDeduplicator();
    const articles = [
      makeArticle({ id: "first", title: "Central bank cuts interest rates" }),
      makeArticle({
        id: "second",
        title: "Borrowing costs fall after surprise policy decision"
      })
    ];

    expect(deduplicator.deduplicate(articles)).toEqual(articles);
  });

  it("keeps separate developments involving the same person", () => {
    const deduplicator = new HeadlineDeduplicator();
    const articles = [
      makeArticle({ id: "borrowing", title: "Burnham faces borrowing warning" }),
      makeArticle({
        id: "schools",
        title: "Burnham announces new technical subjects for schools"
      })
    ];

    expect(deduplicator.deduplicate(articles)).toEqual(articles);
  });

  it("preserves order for unique articles and handles empty input", () => {
    const deduplicator = new HeadlineDeduplicator();
    const articles = [
      makeArticle({ id: "first", title: "First development" }),
      makeArticle({ id: "second", title: "Second development" })
    ];

    expect(deduplicator.deduplicate(articles)).toEqual(articles);
    expect(deduplicator.deduplicate([])).toEqual([]);
  });

  it("does not collapse punctuation-only headlines", () => {
    const deduplicator = new HeadlineDeduplicator();
    const articles = [
      makeArticle({ id: "first", title: "---" }),
      makeArticle({ id: "second", title: "!!!" })
    ];

    expect(deduplicator.deduplicate(articles)).toEqual(articles);
  });
});

describe("createHeadlineFingerprint", () => {
  it("creates a stable normalized fingerprint", () => {
    expect(createHeadlineFingerprint("  Markets—rise AGAIN! ")).toBe(
      "markets rise again"
    );
  });
});

function makeArticle(overrides: Partial<Article>): Article {
  return {
    id: "article-1",
    title: "Shared headline",
    url: "https://example.com/article-1",
    source: "Example News",
    publishedAt: new Date("2026-07-28T01:00:00.000Z"),
    category: "world",
    credibilityScore: 0.8,
    importanceScore: 0.5,
    ...overrides
  };
}
