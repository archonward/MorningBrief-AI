import { describe, expect, it, vi } from "vitest";
import type { NewsCollector } from "../src/collectors/news-collector.js";
import type { Article } from "../src/models/article.js";
import type { RankingAssessment } from "../src/models/ranking-assessment.js";
import {
  FileArticleRepository,
  InMemoryArticleRepository
} from "../src/repositories/article-repository.js";
import {
  inspectAiRanking,
  runAiRankingDiagnosticCommand,
  type AiRankingServicePort
} from "../scripts/inspect-ai-ranking.js";
import { loadRankingPrompt } from "../src/services/ranking-prompt-loader.js";

describe("inspectAiRanking", () => {
  it("reports pipeline counts, limits submitted candidates, and joins assessments in candidate order", async () => {
    const saveProcessedArticle = vi.spyOn(
      InMemoryArticleRepository.prototype,
      "saveProcessedArticle"
    );
    const fileRepositorySave = vi.spyOn(
      FileArticleRepository.prototype,
      "saveProcessedArticle"
    );
    const collector: NewsCollector = {
      collect: vi.fn().mockResolvedValue([
        makeArticle({
          id: "alpha",
          title: "Major Alpha development",
          url: "https://example.com/alpha",
          importanceScore: 0.9,
          content: "Secret article content"
        }),
        makeArticle({
          id: "url-duplicate",
          title: "Duplicate URL",
          url: "https://example.com/alpha?utm_source=rss",
          importanceScore: 0.85
        }),
        makeArticle({
          id: "headline-duplicate",
          title: " major alpha development! ",
          url: "https://example.com/alpha-copy",
          importanceScore: 0.8
        }),
        makeArticle({
          id: "beta",
          title: "Beta event",
          url: "https://example.com/beta",
          importanceScore: 0.7
        }),
        makeArticle({
          id: "gamma",
          title: "Gamma event",
          url: "https://example.com/gamma",
          importanceScore: 0.6
        }),
        makeArticle({
          id: "outside",
          title: "Outside window",
          url: "https://example.com/outside",
          publishedAt: new Date("2026-07-27T10:00:00.000Z"),
          importanceScore: 1
        })
      ])
    };
    const aiRankingService = makeAiRankingService([
      makeAssessment({
        articleId: "beta",
        significanceScore: 0.95,
        confidenceScore: 0.7,
        rationale: "Material impact."
      }),
      makeAssessment({
        articleId: "alpha",
        significanceScore: 0.8,
        confidenceScore: 0.9,
        rationale: "Broad impact.",
        uncertainty: "Limited description."
      })
    ]);

    const report = await inspectAiRanking({
      now: new Date("2026-07-28T03:30:00.000Z"),
      settings: makeSettings({ aiRankingMaxCandidates: 2 }),
      collector,
      aiRankingService
    });

    expect(collector.collect).toHaveBeenCalledWith(
      new Date("2026-07-27T14:00:00.000Z"),
      new Date("2026-07-28T00:00:00.000Z")
    );
    expect(report.counts).toEqual({
      collected: 6,
      filtered: 4,
      ranked: 4,
      exactHeadlineDeduplicated: 3,
      submittedForAiRanking: 2,
      excludedByDiagnosticLimit: 1
    });
    expect(aiRankingService.assess).toHaveBeenCalledTimes(1);
    expect(getSubmittedIds(aiRankingService)).toEqual(["alpha", "beta"]);
    expect(report.candidates.map(({ articleId }) => articleId)).toEqual([
      "alpha",
      "beta"
    ]);
    expect(report.assessments.map(({ articleId }) => articleId)).toEqual([
      "alpha",
      "beta"
    ]);
    expect(report.assessments[0]).toMatchObject({
      candidateNumber: 1,
      articleId: "alpha",
      title: "Major Alpha development",
      source: "Example News",
      significanceScore: 0.8,
      confidenceScore: 0.9,
      rationale: "Broad impact.",
      uncertainty: "Limited description."
    });
    expect(report.aiRanking.map(({ articleId }) => articleId)).toEqual([
      "beta",
      "alpha"
    ]);
    expect(JSON.stringify(report)).not.toContain("Secret article content");
    expect(JSON.stringify(report)).not.toContain("sk-test-secret");
    expect(saveProcessedArticle).not.toHaveBeenCalled();
    expect(fileRepositorySave).not.toHaveBeenCalled();
    saveProcessedArticle.mockRestore();
    fileRepositorySave.mockRestore();
  });

  it("does not call the AI service for an empty candidate batch", async () => {
    const collector: NewsCollector = {
      collect: vi.fn().mockResolvedValue([])
    };
    const aiRankingService = makeAiRankingService([]);

    const report = await inspectAiRanking({
      now: new Date("2026-07-28T03:30:00.000Z"),
      settings: makeSettings(),
      collector,
      aiRankingService
    });

    expect(report.counts).toMatchObject({
      collected: 0,
      filtered: 0,
      ranked: 0,
      exactHeadlineDeduplicated: 0,
      submittedForAiRanking: 0,
      excludedByDiagnosticLimit: 0
    });
    expect(report.candidates).toEqual([]);
    expect(report.assessments).toEqual([]);
    expect(report.aiRanking).toEqual([]);
    expect(aiRankingService.assess).not.toHaveBeenCalled();
  });

  it("sorts a separate AI ranking view without mutating candidates or assessments", async () => {
    const articles = Object.freeze([
      Object.freeze(
        makeArticle({
          id: "first",
          title: "First",
          url: "https://example.com/first",
          importanceScore: 0.9
        })
      ),
      Object.freeze(
        makeArticle({
          id: "second",
          title: "Second",
          url: "https://example.com/second",
          importanceScore: 0.8
        })
      ),
      Object.freeze(
        makeArticle({
          id: "third",
          title: "Third",
          url: "https://example.com/third",
          importanceScore: 0.7
        })
      ),
      Object.freeze(
        makeArticle({
          id: "fourth",
          title: "Fourth",
          url: "https://example.com/fourth",
          importanceScore: 0.6
        })
      )
    ]);
    const assessments = Object.freeze([
      Object.freeze(
        makeAssessment({
          articleId: "first",
          significanceScore: 0.5,
          confidenceScore: 0.5
        })
      ),
      Object.freeze(
        makeAssessment({
          articleId: "second",
          significanceScore: 0.9,
          confidenceScore: 0.3
        })
      ),
      Object.freeze(
        makeAssessment({
          articleId: "third",
          significanceScore: 0.9,
          confidenceScore: 0.8
        })
      ),
      Object.freeze(
        makeAssessment({
          articleId: "fourth",
          significanceScore: 0.5,
          confidenceScore: 0.5
        })
      )
    ]);
    const articleSnapshot = JSON.stringify(articles);
    const assessmentSnapshot = JSON.stringify(assessments);
    const collector: NewsCollector = {
      collect: vi.fn().mockResolvedValue(articles)
    };
    const aiRankingService = makeAiRankingService(assessments);

    const report = await inspectAiRanking({
      now: new Date("2026-07-28T03:30:00.000Z"),
      settings: makeSettings({ aiRankingMaxCandidates: 4 }),
      collector,
      aiRankingService
    });

    expect(report.candidates.map(({ articleId }) => articleId)).toEqual([
      "first",
      "second",
      "third",
      "fourth"
    ]);
    expect(report.assessments.map(({ articleId }) => articleId)).toEqual([
      "first",
      "second",
      "third",
      "fourth"
    ]);
    expect(report.aiRanking.map(({ articleId }) => articleId)).toEqual([
      "third",
      "second",
      "first",
      "fourth"
    ]);
    expect(JSON.stringify(articles)).toBe(articleSnapshot);
    expect(JSON.stringify(assessments)).toBe(assessmentSnapshot);
  });

  it("wraps RSS collection failures clearly", async () => {
    await expect(
      inspectAiRanking({
        now: new Date("2026-07-28T03:30:00.000Z"),
        settings: makeSettings(),
        collector: {
          collect: vi.fn().mockRejectedValue(new Error("all feeds failed"))
        },
        aiRankingService: makeAiRankingService([])
      })
    ).rejects.toThrow("RSS collection failed: all feeds failed");
  });

  it("propagates invalid OpenAI output without fallback results", async () => {
    await expect(
      inspectAiRanking({
        now: new Date("2026-07-28T03:30:00.000Z"),
        settings: makeSettings(),
        collector: {
          collect: vi.fn().mockResolvedValue([makeArticle({ id: "one" })])
        },
        aiRankingService: {
          assess: vi
            .fn()
            .mockRejectedValue(
              new Error("OpenAI ranking response contained invalid JSON")
            )
        }
      })
    ).rejects.toThrow("Invalid OpenAI output");
  });

  it("propagates response-contract validation failures without fallback results", async () => {
    await expect(
      inspectAiRanking({
        now: new Date("2026-07-28T03:30:00.000Z"),
        settings: makeSettings(),
        collector: {
          collect: vi.fn().mockResolvedValue([makeArticle({ id: "one" })])
        },
        aiRankingService: {
          assess: vi
            .fn()
            .mockRejectedValue(
              new Error(
                'Invalid ranking response: missing assessment for article ID "one"'
              )
            )
        }
      })
    ).rejects.toThrow("Response-contract validation failed");
  });

  it("wraps provider failures without fallback results", async () => {
    await expect(
      inspectAiRanking({
        now: new Date("2026-07-28T03:30:00.000Z"),
        settings: makeSettings(),
        collector: {
          collect: vi.fn().mockResolvedValue([makeArticle({ id: "one" })])
        },
        aiRankingService: {
          assess: vi.fn().mockRejectedValue(new Error("network unavailable"))
        }
      })
    ).rejects.toThrow("AI ranking provider failed: network unavailable");
  });
});

describe("runAiRankingDiagnosticCommand", () => {
  it("reports missing prompt files clearly", async () => {
    await expect(
      loadRankingPrompt("prompts/does-not-exist.md")
    ).rejects.toThrow(
      "Could not load AI ranking prompt at prompts/does-not-exist.md"
    );
  });

  it("propagates prompt-loading failures before constructing the AI service", async () => {
    const aiRankingServiceFactory = vi.fn();

    await expect(
      runAiRankingDiagnosticCommand({
        now: new Date("2026-07-28T03:30:00.000Z"),
        appSettings: {
          userTimezone: "Asia/Singapore",
          briefingHour: 8,
          newsLookbackHours: 10
        },
        diagnosticSettings: {
          openAiApiKey: "sk-test-secret",
          openAiRankingModel: "gpt-ranking",
          aiRankingMaxCandidates: 20
        },
        collector: {
          collect: vi.fn().mockResolvedValue([])
        },
        promptLoader: vi.fn().mockRejectedValue(new Error("prompt missing")),
        aiRankingServiceFactory
      })
    ).rejects.toThrow("prompt missing");
    expect(aiRankingServiceFactory).not.toHaveBeenCalled();
  });
});

function makeSettings(
  overrides: Partial<{
    aiRankingMaxCandidates: number;
  }> = {}
) {
  return {
    userTimezone: "Asia/Singapore",
    briefingHour: 8,
    newsLookbackHours: 10,
    openAiRankingModel: "gpt-ranking",
    aiRankingMaxCandidates: 20,
    ...overrides
  };
}

function makeAiRankingService(
  assessments: readonly RankingAssessment[]
): AiRankingServicePort & {
  assess: ReturnType<typeof vi.fn>;
} {
  return {
    assess: vi.fn().mockResolvedValue(assessments)
  };
}

function getSubmittedIds(
  aiRankingService: AiRankingServicePort & { assess: ReturnType<typeof vi.fn> }
): string[] {
  return aiRankingService.assess.mock.calls[0][0].map(
    (article: Article) => article.id
  );
}

function makeArticle(overrides: Partial<Article>): Article {
  return {
    id: "article-1",
    title: "Example headline",
    url: "https://example.com/article-1",
    source: "Example News",
    publishedAt: new Date("2026-07-27T20:00:00.000Z"),
    description: "Example description",
    content: "Example content",
    category: "world",
    credibilityScore: 0.8,
    importanceScore: 0.5,
    ...overrides
  };
}

function makeAssessment(
  overrides: Partial<RankingAssessment>
): RankingAssessment {
  return {
    articleId: "article-1",
    significanceScore: 0.75,
    confidenceScore: 0.8,
    rationale: "Evidence-based rationale.",
    ...overrides
  };
}
