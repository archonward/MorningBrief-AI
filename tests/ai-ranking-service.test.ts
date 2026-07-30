import { describe, expect, it } from "vitest";
import type { Article } from "../src/models/article.js";
import type { RankingRequest } from "../src/models/ranking-request.js";
import { AiRankingService } from "../src/services/ai-ranking-service.js";
import type { RankingProvider } from "../src/services/ranking-provider.js";

describe("AiRankingService", () => {
  it("sends one structured request and returns validated assessments in candidate order", async () => {
    const candidates = [
      makeArticle({
        id: "first",
        title: "First development",
        url: "https://example.com/first",
        source: "Publisher One",
        publishedAt: new Date("2026-07-28T01:00:00.000Z"),
        description: "First description",
        content: "First content",
        category: "world",
        credibilityScore: 0.95,
        importanceScore: 0.9
      }),
      makeArticle({
        id: "second",
        title: "Second development",
        url: "https://example.com/second",
        source: "Publisher Two",
        publishedAt: new Date("2026-07-28T02:00:00.000Z"),
        description: "Second description",
        content: undefined,
        category: "business",
        credibilityScore: 0.7,
        importanceScore: 0.6
      })
    ];
    const providerResponse = {
      assessments: [
        makeAssessment({
          articleId: "second",
          significanceScore: 0.65,
          rationale: "  Relevant economic development.  "
        }),
        makeAssessment({
          articleId: "first",
          significanceScore: 0.9,
          rationale: "Major international development."
        })
      ]
    };
    const provider = new FakeRankingProvider(providerResponse);
    const service = new AiRankingService(provider);

    const result = await service.assess(candidates);

    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]).toEqual({
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
          publishedAt: "2026-07-28T02:00:00.000Z",
          description: "Second description",
          category: "business"
        }
      ]
    });
    expect(provider.requests[0]?.candidates[0]).not.toHaveProperty(
      "credibilityScore"
    );
    expect(provider.requests[0]?.candidates[0]).not.toHaveProperty(
      "importanceScore"
    );
    expect(result.map(({ articleId }) => articleId)).toEqual([
      "first",
      "second"
    ]);
    expect(result[1]?.rationale).toBe("Relevant economic development.");
    expect(result).not.toBe(providerResponse.assessments);
  });

  it("rejects a malformed provider response", async () => {
    const service = new AiRankingService(
      new FakeRankingProvider({ assessments: "invalid" })
    );

    await expect(
      service.assess([makeArticle({ id: "article-1" })])
    ).rejects.toThrow("Invalid ranking response");
  });

  it("rejects a provider response with a missing candidate assessment", async () => {
    const service = new AiRankingService(
      new FakeRankingProvider({
        assessments: [makeAssessment({ articleId: "first" })]
      })
    );

    await expect(
      service.assess([
        makeArticle({ id: "first" }),
        makeArticle({
          id: "second",
          url: "https://example.com/second"
        })
      ])
    ).rejects.toThrow('missing assessment for article ID "second"');
  });

  it("rejects a provider response with an unknown article ID", async () => {
    const service = new AiRankingService(
      new FakeRankingProvider({
        assessments: [
          makeAssessment({ articleId: "article-1" }),
          makeAssessment({ articleId: "unknown" })
        ]
      })
    );

    await expect(
      service.assess([makeArticle({ id: "article-1" })])
    ).rejects.toThrow('unknown article ID "unknown"');
  });

  it("rejects duplicate candidate IDs before calling the provider", async () => {
    const provider = new FakeRankingProvider({ assessments: [] });
    const service = new AiRankingService(provider);

    await expect(
      service.assess([
        makeArticle({ id: "duplicate" }),
        makeArticle({
          id: "duplicate",
          url: "https://example.com/duplicate"
        })
      ])
    ).rejects.toThrow('Duplicate article ID "duplicate"');
    expect(provider.requests).toEqual([]);
  });

  it("returns an empty list without calling the provider for an empty batch", async () => {
    const provider = new FakeRankingProvider({ assessments: [] });
    const service = new AiRankingService(provider);

    await expect(service.assess([])).resolves.toEqual([]);
    expect(provider.requests).toEqual([]);
  });

  it("does not mutate frozen candidates, provider request, or provider response", async () => {
    const article = Object.freeze(
      makeArticle({
        id: "article-1",
        title: "Original title",
        publishedAt: new Date("2026-07-28T01:00:00.000Z")
      })
    );
    const candidates = Object.freeze([article]);
    const assessment = Object.freeze(
      makeAssessment({ articleId: "article-1" })
    );
    const assessments = Object.freeze([assessment]);
    const providerResponse = Object.freeze({ assessments });
    let capturedRequest: RankingRequest | undefined;
    let capturedRequestSnapshot = "";
    const provider: RankingProvider = {
      rank: async (request) => {
        capturedRequest = request;
        capturedRequestSnapshot = JSON.stringify(request);
        Object.freeze(request.candidates[0]);
        Object.freeze(request.candidates);
        Object.freeze(request);
        return providerResponse;
      }
    };
    const service = new AiRankingService(provider);

    const result = await service.assess(candidates);

    expect(article.title).toBe("Original title");
    expect(JSON.stringify(capturedRequest)).toBe(capturedRequestSnapshot);
    expect(providerResponse.assessments).toBe(assessments);
    expect(result).toEqual([assessment]);
  });

  it("propagates provider errors unchanged", async () => {
    const providerError = new Error("Provider unavailable");
    const provider = new FakeRankingProvider(undefined, providerError);
    const service = new AiRankingService(provider);

    await expect(
      service.assess([makeArticle({ id: "article-1" })])
    ).rejects.toBe(providerError);
  });
});

class FakeRankingProvider implements RankingProvider {
  public readonly requests: RankingRequest[] = [];

  public constructor(
    private readonly response: unknown,
    private readonly error?: Error
  ) {}

  public async rank(request: RankingRequest): Promise<unknown> {
    this.requests.push(request);

    if (this.error !== undefined) {
      throw this.error;
    }

    return this.response;
  }
}

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

function makeAssessment(
  overrides: Partial<{
    articleId: string;
    significanceScore: number;
    confidenceScore: number;
    rationale: string;
    uncertainty: string;
  }>
) {
  return {
    articleId: "article-1",
    significanceScore: 0.75,
    confidenceScore: 0.8,
    rationale: "This development has broad policy implications.",
    ...overrides
  };
}
