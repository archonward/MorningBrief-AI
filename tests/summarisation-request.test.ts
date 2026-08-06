import { describe, expect, it } from "vitest";
import type { Article } from "../src/models/article.js";
import {
  createSummarisationRequest,
  SummarisationRequestSchema,
  type SummarisationRequest
} from "../src/models/summarisation-request.js";
import type { SummarisationProvider } from "../src/services/summarisation-provider.js";

describe("createSummarisationRequest", () => {
  it("projects selected articles into a JSON-safe request in selected order", () => {
    const selectedArticles = [
      makeArticle({
        id: "first",
        title: "First development",
        source: "Publisher One",
        url: "https://example.com/first",
        publishedAt: new Date("2026-08-05T23:15:00.000Z"),
        description: "First description",
        content: "First article content",
        category: "world"
      }),
      makeArticle({
        id: "second",
        title: "Second development",
        source: "Publisher Two",
        url: "https://example.com/second",
        publishedAt: new Date("2026-08-06T00:30:00.000Z"),
        description: "Second description",
        content: undefined,
        category: "business"
      })
    ];

    const request = createSummarisationRequest(selectedArticles);

    expect(request).toEqual({
      articles: [
        {
          articleId: "first",
          title: "First development",
          source: "Publisher One",
          url: "https://example.com/first",
          publishedAt: "2026-08-05T23:15:00.000Z",
          description: "First description",
          content: "First article content",
          category: "world"
        },
        {
          articleId: "second",
          title: "Second development",
          source: "Publisher Two",
          url: "https://example.com/second",
          publishedAt: "2026-08-06T00:30:00.000Z",
          description: "Second description",
          category: "business"
        }
      ]
    });
    expect(JSON.parse(JSON.stringify(request))).toEqual(request);
  });

  it("omits optional evidence fields when unavailable", () => {
    const request = createSummarisationRequest([
      makeArticle({
        description: undefined,
        content: undefined,
        category: undefined
      })
    ]);

    expect(request.articles[0]).not.toHaveProperty("description");
    expect(request.articles[0]).not.toHaveProperty("content");
    expect(request.articles[0]).not.toHaveProperty("category");
  });

  it("includes source and URL as contextual evidence", () => {
    const request = createSummarisationRequest([
      makeArticle({
        source: "Trusted Publisher",
        url: "https://example.com/context"
      })
    ]);

    expect(request.articles[0]).toMatchObject({
      source: "Trusted Publisher",
      url: "https://example.com/context"
    });
  });

  it("excludes ranking, scoring, and diagnostic internals", () => {
    const article = {
      ...makeArticle({ credibilityScore: 0.9, importanceScore: 0.8 }),
      significanceScore: 0.95,
      confidenceScore: 0.85,
      rankingRationale: "Ranking rationale",
      rankingUncertainty: "Ranking uncertainty",
      candidatePairDiagnostics: { overlap: 0.8 },
      processedHistory: true,
      apiKey: "secret",
      model: "model-name",
      prompt: "instructions"
    };

    const request = createSummarisationRequest([article]);
    const requestArticle = request.articles[0];

    for (const field of [
      "credibilityScore",
      "importanceScore",
      "significanceScore",
      "confidenceScore",
      "rankingRationale",
      "rankingUncertainty",
      "candidatePairDiagnostics",
      "processedHistory",
      "apiKey",
      "model",
      "prompt"
    ]) {
      expect(requestArticle).not.toHaveProperty(field);
    }
  });

  it("returns an empty request for an empty selected batch", () => {
    expect(createSummarisationRequest([])).toEqual({ articles: [] });
  });

  it("rejects duplicate article IDs clearly", () => {
    expect(() =>
      createSummarisationRequest([
        makeArticle({ id: "duplicate" }),
        makeArticle({
          id: "duplicate",
          url: "https://example.com/duplicate-copy"
        })
      ])
    ).toThrow(
      'Invalid summarisation request: Duplicate article ID "duplicate"'
    );
  });

  it("does not mutate frozen articles or their original Date objects", () => {
    const publishedAt = new Date("2026-08-05T23:15:00.000Z");
    const originalTimestamp = publishedAt.getTime();
    const article = Object.freeze(
      makeArticle({
        id: "frozen",
        title: "Original title",
        publishedAt
      })
    );
    const selectedArticles = Object.freeze([article]);

    const request = createSummarisationRequest(selectedArticles);

    expect(article.title).toBe("Original title");
    expect(article.publishedAt).toBe(publishedAt);
    expect(publishedAt.getTime()).toBe(originalTimestamp);
    expect(request.articles[0]).not.toBe(article);
    expect(request.articles[0]?.publishedAt).toBe(
      "2026-08-05T23:15:00.000Z"
    );
  });

  it("returns a new request and new request article objects", () => {
    const selectedArticles = [makeArticle({ id: "article-1" })];
    const first = createSummarisationRequest(selectedArticles);
    const second = createSummarisationRequest(selectedArticles);

    expect(first).not.toBe(second);
    expect(first.articles).not.toBe(second.articles);
    expect(first.articles[0]).not.toBe(selectedArticles[0]);
    expect(first.articles[0]).not.toBe(second.articles[0]);
  });

  it("prefixes invalid projected request errors clearly", () => {
    expect(() =>
      createSummarisationRequest([
        makeArticle({ publishedAt: new Date(Number.NaN) })
      ])
    ).toThrow("Invalid summarisation request:");
  });
});

describe("SummarisationRequestSchema", () => {
  const validRequestArticle = {
    articleId: "article-1",
    title: "Example headline",
    source: "Example News",
    url: "https://example.com/article-1",
    publishedAt: "2026-08-05T23:15:00.000Z"
  };

  it("rejects duplicate IDs at the request-schema level", () => {
    const result = SummarisationRequestSchema.safeParse({
      articles: [validRequestArticle, { ...validRequestArticle }]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["articles", 1, "articleId"],
            message: 'Duplicate article ID "article-1"'
          })
        ])
      );
    }
  });

  it("rejects unexpected top-level request properties", () => {
    expect(
      SummarisationRequestSchema.safeParse({
        articles: [],
        model: "untrusted-model"
      }).success
    ).toBe(false);
  });

  it("rejects unexpected request article properties", () => {
    expect(
      SummarisationRequestSchema.safeParse({
        articles: [{ ...validRequestArticle, importanceScore: 1 }]
      }).success
    ).toBe(false);
  });

  it("rejects timestamps without timezone information", () => {
    expect(
      SummarisationRequestSchema.safeParse({
        articles: [
          { ...validRequestArticle, publishedAt: "2026-08-05T23:15:00" }
        ]
      }).success
    ).toBe(false);
  });
});

describe("SummarisationProvider", () => {
  it("accepts a structured request and leaves malformed output untrusted", async () => {
    const malformedResponse: unknown = { items: "not validated here" };
    const provider: SummarisationProvider = {
      summarise: async (request: SummarisationRequest): Promise<unknown> => {
        expect(request.articles.map(({ articleId }) => articleId)).toEqual([
          "article-1"
        ]);
        return malformedResponse;
      }
    };
    const request = createSummarisationRequest([
      makeArticle({ id: "article-1" })
    ]);

    await expect(provider.summarise(request)).resolves.toBe(malformedResponse);
  });
});

function makeArticle(overrides: Partial<Article>): Article {
  return {
    id: "article-1",
    title: "Example headline",
    url: "https://example.com/article-1",
    source: "Example News",
    publishedAt: new Date("2026-08-05T23:15:00.000Z"),
    description: "Example description",
    content: "Example content",
    category: "world",
    credibilityScore: 0.8,
    importanceScore: 0.5,
    ...overrides
  };
}
