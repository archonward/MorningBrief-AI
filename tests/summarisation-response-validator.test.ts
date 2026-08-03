import { describe, expect, it } from "vitest";
import type { Article } from "../src/models/article.js";
import {
  BRIEFING_HEADLINE_MAX_LENGTH,
  BRIEFING_SUMMARY_MAX_LENGTH,
  BRIEFING_WHY_IT_MATTERS_MAX_LENGTH
} from "../src/models/briefing.js";
import { SUMMARISATION_UNCERTAINTY_MAX_LENGTH } from "../src/models/summarisation.js";
import { validateSummarisationResponse } from "../src/services/summarisation-response-validator.js";

describe("validateSummarisationResponse", () => {
  it("accepts exactly one valid item for every selected article", () => {
    const selectedArticles = [
      makeArticle({ id: "article-1" }),
      makeArticle({ id: "article-2" })
    ];
    const response = {
      items: [
        makeItem({ articleId: "article-1" }),
        makeItem({
          articleId: "article-2",
          headline: "Second development",
          uncertainty: "The available RSS description is brief."
        })
      ]
    };

    expect(validateSummarisationResponse(selectedArticles, response)).toEqual(
      response.items
    );
  });

  it("returns items in selected-article order when provider order differs", () => {
    const selectedArticles = [
      makeArticle({ id: "first" }),
      makeArticle({ id: "second" }),
      makeArticle({ id: "third" })
    ];

    const result = validateSummarisationResponse(selectedArticles, {
      items: [
        makeItem({ articleId: "third" }),
        makeItem({ articleId: "first" }),
        makeItem({ articleId: "second" })
      ]
    });

    expect(result.map(({ articleId }) => articleId)).toEqual([
      "first",
      "second",
      "third"
    ]);
  });

  it("rejects a missing selected article item", () => {
    expect(() =>
      validateSummarisationResponse(
        [makeArticle({ id: "first" }), makeArticle({ id: "second" })],
        { items: [makeItem({ articleId: "first" })] }
      )
    ).toThrow('missing item for article ID "second"');
  });

  it("rejects duplicate response article IDs", () => {
    expect(() =>
      validateSummarisationResponse([makeArticle({ id: "article-1" })], {
        items: [
          makeItem({ articleId: "article-1" }),
          makeItem({ articleId: "article-1" })
        ]
      })
    ).toThrow('duplicate article ID "article-1"');
  });

  it("rejects unknown response article IDs", () => {
    expect(() =>
      validateSummarisationResponse([makeArticle({ id: "article-1" })], {
        items: [
          makeItem({ articleId: "article-1" }),
          makeItem({ articleId: "unknown" })
        ]
      })
    ).toThrow('unknown article ID "unknown"');
  });

  it("rejects duplicate IDs in the selected article batch", () => {
    expect(() =>
      validateSummarisationResponse(
        [
          makeArticle({ id: "duplicate" }),
          makeArticle({
            id: "duplicate",
            url: "https://example.com/duplicate-copy"
          })
        ],
        { items: [makeItem({ articleId: "duplicate" })] }
      )
    ).toThrow('Invalid selected article batch: duplicate article ID "duplicate"');
  });

  it.each([
    ["articleId", ""],
    ["articleId", "   "],
    ["articleId", " article-1 "],
    ["headline", ""],
    ["headline", "   "],
    ["summary", ""],
    ["summary", "   "],
    ["whyItMatters", ""],
    ["whyItMatters", "   "]
  ])("rejects an empty required %s", (field, value) => {
    expect(() =>
      validateSummarisationResponse([makeArticle({ id: "article-1" })], {
        items: [makeItem({ [field]: value })]
      })
    ).toThrow(`items.0.${field}`);
  });

  it.each([
    ["headline", BRIEFING_HEADLINE_MAX_LENGTH],
    ["summary", BRIEFING_SUMMARY_MAX_LENGTH],
    ["whyItMatters", BRIEFING_WHY_IT_MATTERS_MAX_LENGTH]
  ] as const)("rejects overlong %s text", (field, maximumLength) => {
    expect(() =>
      validateSummarisationResponse([makeArticle({ id: "article-1" })], {
        items: [makeItem({ [field]: "x".repeat(maximumLength + 1) })]
      })
    ).toThrow(`items.0.${field}`);
  });

  it.each([
    "",
    "   ",
    "x".repeat(SUMMARISATION_UNCERTAINTY_MAX_LENGTH + 1)
  ])("rejects invalid uncertainty", (uncertainty) => {
    expect(() =>
      validateSummarisationResponse([makeArticle({ id: "article-1" })], {
        items: [makeItem({ uncertainty })]
      })
    ).toThrow("items.0.uncertainty");
  });

  it("normalises strict-output null uncertainty to absence", () => {
    const [item] = validateSummarisationResponse(
      [makeArticle({ id: "article-1" })],
      { items: [makeItem({ uncertainty: null })] }
    );

    expect(item?.uncertainty).toBeUndefined();
  });

  it.each([null, [], {}, { items: null }, { items: "invalid" }])(
    "rejects malformed top-level response %#",
    (response) => {
      expect(() => validateSummarisationResponse([], response)).toThrow(
        "Invalid summarisation response"
      );
    }
  );

  it("rejects unexpected top-level fields", () => {
    expect(() =>
      validateSummarisationResponse([], { items: [], unexpected: true })
    ).toThrow("Unrecognized key");
  });

  it.each([
    ["source", "Untrusted source"],
    ["url", "https://malicious.example/replacement"],
    ["publishedAt", "2026-08-01T00:00:00.000Z"],
    ["category", "world"],
    ["credibilityScore", 1],
    ["importanceScore", 1],
    ["significanceScore", 1],
    ["provider", "example"],
    ["model", "example-model"]
  ])("rejects untrusted or unexpected item field %s", (field, value) => {
    expect(() =>
      validateSummarisationResponse([makeArticle({ id: "article-1" })], {
        items: [makeItem({ [field]: value })]
      })
    ).toThrow("Unrecognized key");
  });

  it("accepts an empty response for an empty selected batch", () => {
    const externalItems: unknown[] = [];
    const result = validateSummarisationResponse([], { items: externalItems });

    expect(result).toEqual([]);
    expect(result).not.toBe(externalItems);
  });

  it("rejects a non-empty response for an empty selected batch", () => {
    expect(() =>
      validateSummarisationResponse([], {
        items: [makeItem({ articleId: "unknown" })]
      })
    ).toThrow('unknown article ID "unknown"');
  });

  it("does not mutate frozen articles or external responses", () => {
    const selectedArticles = Object.freeze([
      Object.freeze(makeArticle({ id: "first" })),
      Object.freeze(makeArticle({ id: "second" }))
    ]);
    const firstExternalItem = Object.freeze(
      makeItem({
        articleId: "second",
        headline: "  Second headline  ",
        uncertainty: null
      })
    );
    const secondExternalItem = Object.freeze(
      makeItem({ articleId: "first" })
    );
    const externalItems = Object.freeze([
      firstExternalItem,
      secondExternalItem
    ]);
    const externalResponse = Object.freeze({ items: externalItems });

    const result = validateSummarisationResponse(
      selectedArticles,
      externalResponse
    );

    expect(selectedArticles.map(({ id }) => id)).toEqual(["first", "second"]);
    expect(externalResponse.items.map(({ articleId }) => articleId)).toEqual([
      "second",
      "first"
    ]);
    expect(firstExternalItem.headline).toBe("  Second headline  ");
    expect(firstExternalItem.uncertainty).toBeNull();
    expect(result.map(({ articleId }) => articleId)).toEqual([
      "first",
      "second"
    ]);
    expect(result[1]?.headline).toBe("Second headline");
    expect(result[1]?.uncertainty).toBeUndefined();
    expect(result).not.toBe(externalItems);
  });
});

interface ExternalSummarisationItem {
  articleId: string;
  headline: string;
  summary: string;
  whyItMatters: string;
  uncertainty?: string | null;
  [key: string]: unknown;
}

function makeArticle(overrides: Partial<Article>): Article {
  return {
    id: "article-1",
    title: "Original article title",
    url: "https://example.com/article-1",
    source: "Trusted Publisher",
    publishedAt: new Date("2026-08-01T01:00:00.000Z"),
    description: "Original article description",
    category: "world",
    credibilityScore: 0.8,
    importanceScore: 0.7,
    ...overrides
  };
}

function makeItem(
  overrides: Record<string, unknown> = {}
): ExternalSummarisationItem {
  return {
    articleId: "article-1",
    headline: "Concise briefing headline",
    summary: "A factual account of the specific development.",
    whyItMatters: "The development has practical consequences.",
    ...overrides
  } as ExternalSummarisationItem;
}
