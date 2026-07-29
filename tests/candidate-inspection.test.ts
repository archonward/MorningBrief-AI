import { describe, expect, it, vi } from "vitest";
import type { NewsCollector } from "../src/collectors/news-collector.js";
import type { Article } from "../src/models/article.js";
import { InMemoryArticleRepository } from "../src/repositories/article-repository.js";
import { inspectCandidates } from "../scripts/inspect-candidates.js";

describe("inspectCandidates", () => {
  it("reports each pipeline stage and emits only deduplicated candidates", async () => {
    const saveProcessedArticle = vi.spyOn(
      InMemoryArticleRepository.prototype,
      "saveProcessedArticle"
    );
    const collector: NewsCollector = {
      collect: vi.fn().mockResolvedValue([
        makeArticle({
          id: "highest",
          title: "Markets—rise again!",
          url: "https://publisher-one.example/markets",
          source: "Publisher One",
          importanceScore: 0.9
        }),
        makeArticle({
          id: "url-duplicate",
          title: "Duplicate URL",
          url: "https://publisher-one.example/markets?utm_source=rss",
          source: "Publisher One",
          importanceScore: 0.85
        }),
        makeArticle({
          id: "headline-duplicate",
          title: "  MARKETS rise AGAIN ",
          url: "https://publisher-two.example/report",
          source: "Publisher Two",
          importanceScore: 0.8
        }),
        makeArticle({
          id: "unique",
          title: "A separate development",
          url: "https://publisher-three.example/story",
          source: "Publisher Three",
          importanceScore: 0.7
        })
      ])
    };
    const now = new Date("2026-07-28T03:30:00.000Z");

    const snapshot = await inspectCandidates({
      now,
      settings: {
        userTimezone: "Asia/Singapore",
        briefingHour: 8,
        newsLookbackHours: 10
      },
      collector
    });

    expect(collector.collect).toHaveBeenCalledWith(
      new Date("2026-07-27T14:00:00.000Z"),
      new Date("2026-07-28T00:00:00.000Z")
    );
    expect(snapshot).toMatchObject({
      generatedAt: now.toISOString(),
      window: {
        startTime: "2026-07-27T14:00:00.000Z",
        endTime: "2026-07-28T00:00:00.000Z"
      },
      counts: {
        collected: 4,
        filtered: 3,
        ranked: 3,
        exactHeadlineDeduplicated: 2
      }
    });
    expect(snapshot.candidates.map(({ title }) => title)).toEqual([
      "Markets—rise again!",
      "A separate development"
    ]);
    expect(snapshot.candidates[0]).toEqual({
      title: "Markets—rise again!",
      fingerprint: "markets rise again",
      description: "Example description",
      source: "Publisher One",
      url: "https://publisher-one.example/markets",
      publishedAt: "2026-07-27T20:00:00.000Z",
      category: "world",
      importanceScore: 0.9
    });
    expect(saveProcessedArticle).not.toHaveBeenCalled();
    saveProcessedArticle.mockRestore();
  });

  it("returns an empty candidate list", async () => {
    const collector: NewsCollector = {
      collect: vi.fn().mockResolvedValue([])
    };

    const snapshot = await inspectCandidates({
      now: new Date("2026-07-28T03:30:00.000Z"),
      settings: {
        userTimezone: "Asia/Singapore",
        briefingHour: 8,
        newsLookbackHours: 10
      },
      collector
    });

    expect(snapshot.counts).toEqual({
      collected: 0,
      filtered: 0,
      ranked: 0,
      exactHeadlineDeduplicated: 0
    });
    expect(snapshot.candidates).toEqual([]);
  });
});

function makeArticle(overrides: Partial<Article>): Article {
  return {
    id: "article-1",
    title: "Example headline",
    url: "https://example.com/article-1",
    source: "Example News",
    publishedAt: new Date("2026-07-27T20:00:00.000Z"),
    description: "Example description",
    category: "world",
    credibilityScore: 0.8,
    importanceScore: 0.5,
    ...overrides
  };
}
