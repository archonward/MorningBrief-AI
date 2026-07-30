import { describe, expect, it } from "vitest";
import type { Article } from "../src/models/article.js";
import {
  createRankingRequest,
  type RankingRequest
} from "../src/models/ranking-request.js";
import type { RankingProvider } from "../src/services/ranking-provider.js";

describe("createRankingRequest", () => {
  it("projects candidates into a JSON-safe request in the submitted order", () => {
    const candidates = [
      makeArticle({
        id: "first",
        title: "First development",
        url: "https://example.com/first",
        source: "Publisher One",
        publishedAt: new Date("2026-07-28T01:00:00.000Z"),
        description: "First description",
        content: "First content",
        category: "world"
      }),
      makeArticle({
        id: "second",
        title: "Second development",
        url: "https://example.com/second",
        source: "Publisher Two",
        publishedAt: new Date("2026-07-28T02:30:00.000Z"),
        description: "Second description",
        content: undefined,
        category: "business"
      })
    ];

    const request = createRankingRequest(candidates);

    expect(request).toEqual({
      candidates: [
        {
          articleId: "first",
          title: "First development",
          url: "https://example.com/first",
          source: "Publisher One",
          publishedAt: "2026-07-28T01:00:00.000Z",
          description: "First description",
          content: "First content",
          category: "world"
        },
        {
          articleId: "second",
          title: "Second development",
          url: "https://example.com/second",
          source: "Publisher Two",
          publishedAt: "2026-07-28T02:30:00.000Z",
          description: "Second description",
          category: "business"
        }
      ]
    });
    expect(JSON.parse(JSON.stringify(request))).toEqual(request);
  });

  it("omits optional evidence fields when they are unavailable", () => {
    const request = createRankingRequest([
      makeArticle({
        description: undefined,
        content: undefined,
        category: undefined
      })
    ]);

    expect(request.candidates[0]).not.toHaveProperty("description");
    expect(request.candidates[0]).not.toHaveProperty("content");
    expect(request.candidates[0]).not.toHaveProperty("category");
  });

  it("does not expose deterministic or source credibility scores", () => {
    const request = createRankingRequest([
      makeArticle({ credibilityScore: 0.9, importanceScore: 0.8 })
    ]);

    expect(request.candidates[0]).not.toHaveProperty("credibilityScore");
    expect(request.candidates[0]).not.toHaveProperty("importanceScore");
  });

  it("returns an empty request for an empty candidate batch", () => {
    expect(createRankingRequest([])).toEqual({ candidates: [] });
  });

  it("rejects duplicate candidate article IDs", () => {
    expect(() =>
      createRankingRequest([
        makeArticle({ id: "duplicate" }),
        makeArticle({
          id: "duplicate",
          url: "https://example.com/duplicate"
        })
      ])
    ).toThrow('Duplicate article ID "duplicate"');
  });

  it("does not mutate frozen article inputs", () => {
    const publishedAt = new Date("2026-07-28T01:00:00.000Z");
    const article = Object.freeze(
      makeArticle({
        id: "article-1",
        title: "Original title",
        publishedAt
      })
    );
    const candidates = Object.freeze([article]);

    const request = createRankingRequest(candidates);

    expect(article.title).toBe("Original title");
    expect(article.publishedAt).toBe(publishedAt);
    expect(request.candidates[0]?.publishedAt).toBe(
      "2026-07-28T01:00:00.000Z"
    );
    expect(request.candidates[0]).not.toBe(article);
  });
});

describe("RankingProvider", () => {
  it("accepts the structured request and leaves the response untrusted", async () => {
    const rawResponse: unknown = { assessments: "not validated here" };
    const provider: RankingProvider = {
      rank: async (request: RankingRequest): Promise<unknown> => {
        expect(request.candidates.map(({ articleId }) => articleId)).toEqual([
          "article-1"
        ]);
        return rawResponse;
      }
    };
    const request = createRankingRequest([
      makeArticle({ id: "article-1" })
    ]);

    await expect(provider.rank(request)).resolves.toBe(rawResponse);
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
