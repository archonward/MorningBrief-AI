import { describe, expect, it } from "vitest";
import type { Article } from "../src/models/article.js";
import {
  RANKING_RATIONALE_MAX_LENGTH,
  RANKING_UNCERTAINTY_MAX_LENGTH
} from "../src/models/ranking-assessment.js";
import { validateRankingResponse } from "../src/services/ranking-response-validator.js";

describe("validateRankingResponse", () => {
  it("accepts exactly one valid assessment for every candidate", () => {
    const candidates = [
      makeArticle({ id: "article-1" }),
      makeArticle({ id: "article-2" })
    ];
    const response = {
      assessments: [
        makeAssessment({ articleId: "article-1" }),
        makeAssessment({
          articleId: "article-2",
          significanceScore: 0,
          confidenceScore: 1,
          uncertainty: "The source description is brief."
        })
      ]
    };

    expect(validateRankingResponse(candidates, response)).toEqual(
      response.assessments
    );
  });

  it("returns assessments in candidate order when provider order differs", () => {
    const candidates = [
      makeArticle({ id: "first" }),
      makeArticle({ id: "second" }),
      makeArticle({ id: "third" })
    ];
    const response = {
      assessments: [
        makeAssessment({ articleId: "third" }),
        makeAssessment({ articleId: "first" }),
        makeAssessment({ articleId: "second" })
      ]
    };

    const result = validateRankingResponse(candidates, response);

    expect(result.map(({ articleId }) => articleId)).toEqual([
      "first",
      "second",
      "third"
    ]);
  });

  it("rejects a missing candidate assessment", () => {
    const candidates = [
      makeArticle({ id: "article-1" }),
      makeArticle({ id: "article-2" })
    ];

    expect(() =>
      validateRankingResponse(candidates, {
        assessments: [makeAssessment({ articleId: "article-1" })]
      })
    ).toThrow('missing assessment for article ID "article-2"');
  });

  it("rejects duplicate assessment article IDs", () => {
    const candidates = [makeArticle({ id: "article-1" })];

    expect(() =>
      validateRankingResponse(candidates, {
        assessments: [
          makeAssessment({ articleId: "article-1" }),
          makeAssessment({ articleId: "article-1" })
        ]
      })
    ).toThrow('duplicate article ID "article-1"');
  });

  it("rejects an unknown assessment article ID", () => {
    const candidates = [makeArticle({ id: "article-1" })];

    expect(() =>
      validateRankingResponse(candidates, {
        assessments: [
          makeAssessment({ articleId: "article-1" }),
          makeAssessment({ articleId: "unknown" })
        ]
      })
    ).toThrow('unknown article ID "unknown"');
  });

  it("rejects an empty article ID", () => {
    expect(() =>
      validateRankingResponse([makeArticle({ id: "article-1" })], {
        assessments: [makeAssessment({ articleId: "   " })]
      })
    ).toThrow("assessments.0.articleId");
  });

  it.each([
    ["significanceScore", -0.01],
    ["significanceScore", 1.01],
    ["confidenceScore", -0.01],
    ["confidenceScore", 1.01]
  ] as const)("rejects %s value %s outside zero to one", (field, value) => {
    expect(() =>
      validateRankingResponse([makeArticle({ id: "article-1" })], {
        assessments: [makeAssessment({ [field]: value })]
      })
    ).toThrow(`assessments.0.${field}`);
  });

  it.each([
    ["significanceScore", Number.NaN],
    ["significanceScore", Number.POSITIVE_INFINITY],
    ["confidenceScore", Number.NEGATIVE_INFINITY]
  ] as const)("rejects non-finite %s", (field, value) => {
    expect(() =>
      validateRankingResponse([makeArticle({ id: "article-1" })], {
        assessments: [makeAssessment({ [field]: value })]
      })
    ).toThrow(`assessments.0.${field}`);
  });

  it("rejects an empty or whitespace-only rationale", () => {
    expect(() =>
      validateRankingResponse([makeArticle({ id: "article-1" })], {
        assessments: [makeAssessment({ rationale: "   " })]
      })
    ).toThrow("assessments.0.rationale");
  });

  it("rejects rationale beyond the maximum length", () => {
    expect(() =>
      validateRankingResponse([makeArticle({ id: "article-1" })], {
        assessments: [
          makeAssessment({
            rationale: "x".repeat(RANKING_RATIONALE_MAX_LENGTH + 1)
          })
        ]
      })
    ).toThrow("assessments.0.rationale");
  });

  it.each(["", "   ", "x".repeat(RANKING_UNCERTAINTY_MAX_LENGTH + 1)])(
    "rejects invalid optional uncertainty",
    (uncertainty) => {
      expect(() =>
        validateRankingResponse([makeArticle({ id: "article-1" })], {
          assessments: [makeAssessment({ uncertainty })]
        })
      ).toThrow("assessments.0.uncertainty");
    }
  );

  it("accepts an empty response for an empty candidate batch", () => {
    expect(validateRankingResponse([], { assessments: [] })).toEqual([]);
  });

  it("normalises strict-output null uncertainty to absence", () => {
    const [assessment] = validateRankingResponse(
      [makeArticle({ id: "article-1" })],
      {
        assessments: [
          makeAssessment({ articleId: "article-1", uncertainty: null })
        ]
      }
    );

    expect(assessment?.uncertainty).toBeUndefined();
  });

  it("does not mutate the candidates or external response", () => {
    const candidates = Object.freeze([
      Object.freeze(makeArticle({ id: "article-1" })),
      Object.freeze(makeArticle({ id: "article-2" }))
    ]);
    const firstAssessment = Object.freeze(
      makeAssessment({ articleId: "article-2", rationale: "  Brief reason  " })
    );
    const secondAssessment = Object.freeze(
      makeAssessment({ articleId: "article-1" })
    );
    const assessments = Object.freeze([firstAssessment, secondAssessment]);
    const response = Object.freeze({ assessments });

    const result = validateRankingResponse(candidates, response);

    expect(candidates.map(({ id }) => id)).toEqual(["article-1", "article-2"]);
    expect(response.assessments.map(({ articleId }) => articleId)).toEqual([
      "article-2",
      "article-1"
    ]);
    expect(firstAssessment.rationale).toBe("  Brief reason  ");
    expect(result.map(({ articleId }) => articleId)).toEqual([
      "article-1",
      "article-2"
    ]);
    expect(result[1]?.rationale).toBe("Brief reason");
    expect(result).not.toBe(response.assessments);
  });

  it("rejects malformed response shapes", () => {
    expect(() => validateRankingResponse([], [])).toThrow(
      "Invalid ranking response"
    );
    expect(() =>
      validateRankingResponse([], { assessments: [], unexpected: true })
    ).toThrow("Unrecognized key");
  });

  it("rejects duplicate IDs in the submitted candidate batch", () => {
    const candidates = [
      makeArticle({ id: "article-1" }),
      makeArticle({ id: "article-1", url: "https://example.com/duplicate" })
    ];

    expect(() =>
      validateRankingResponse(candidates, {
        assessments: [makeAssessment({ articleId: "article-1" })]
      })
    ).toThrow('Invalid candidate batch: duplicate article ID "article-1"');
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
    uncertainty: string | null;
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
