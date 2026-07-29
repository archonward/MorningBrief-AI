import { describe, expect, it } from "vitest";
import type { Article } from "../src/models/article.js";
import { createCandidatePairDiagnostics } from "../src/diagnostics/candidate-pair-diagnostics.js";

describe("createCandidatePairDiagnostics", () => {
  it("emits every unordered pair in stable ranked order", () => {
    const articles = [
      makeArticle({
        id: "first",
        title: "Alpha announces Orion",
        source: "Publisher One",
        publishedAt: new Date("2026-07-28T01:00:00.000Z"),
        description: "Alpha launched a satellite today",
        category: "technology"
      }),
      makeArticle({
        id: "second",
        title: "Alpha launches Orion",
        source: "Publisher Two",
        publishedAt: new Date("2026-07-28T01:30:00.000Z"),
        description: "Today Alpha launched the satellite",
        category: "technology"
      }),
      makeArticle({
        id: "third",
        title: "A separate story",
        source: "Publisher Three",
        publishedAt: new Date("2026-07-28T03:00:00.000Z"),
        description: undefined,
        category: "science"
      })
    ];
    const originalOrder = articles.map(({ id }) => id);

    const diagnostics = createCandidatePairDiagnostics(articles);

    expect(
      diagnostics.map(({ leftCandidate, rightCandidate }) => [
        leftCandidate,
        rightCandidate
      ])
    ).toEqual([
      [1, 2],
      [1, 3],
      [2, 3]
    ]);
    expect(diagnostics).toHaveLength(
      (articles.length * (articles.length - 1)) / 2
    );
    expect(articles.map(({ id }) => id)).toEqual(originalOrder);
  });

  it("reports raw pair features without a score or match decision", () => {
    const [pair] = createCandidatePairDiagnostics([
      makeArticle({
        title: "Alpha announces Orion",
        source: "Publisher One",
        publishedAt: new Date("2026-07-28T01:00:00.000Z"),
        description: "Alpha launched a satellite today",
        category: "technology"
      }),
      makeArticle({
        title: "Alpha launches Orion",
        source: "Publisher Two",
        publishedAt: new Date("2026-07-28T01:30:00.000Z"),
        description: "Today Alpha launched the satellite",
        category: "technology"
      })
    ]);

    expect(pair).toEqual({
      leftCandidate: 1,
      rightCandidate: 2,
      sharedHeadlineTokens: ["alpha", "orion"],
      headlineTokenJaccard: 0.5,
      sharedDescriptionTokens: ["alpha", "launched", "satellite", "today"],
      descriptionTokenJaccard: 0.6667,
      publicationTimeDifferenceMinutes: 30,
      sameCategory: true,
      sameSource: false,
      headlineLengthDifference: 1
    });
    expect(pair).not.toHaveProperty("score");
    expect(pair).not.toHaveProperty("isMatch");
  });

  it("uses null description metrics when either description is unavailable", () => {
    const [pair] = createCandidatePairDiagnostics([
      makeArticle({ description: "Available description" }),
      makeArticle({
        id: "without-description",
        url: "https://example.com/without-description",
        description: undefined
      })
    ]);

    expect(pair?.sharedDescriptionTokens).toBeNull();
    expect(pair?.descriptionTokenJaccard).toBeNull();
  });

  it("returns no pairs for fewer than two candidates", () => {
    expect(createCandidatePairDiagnostics([])).toEqual([]);
    expect(createCandidatePairDiagnostics([makeArticle({})])).toEqual([]);
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
