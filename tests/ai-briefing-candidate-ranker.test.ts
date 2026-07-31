import { describe, expect, it, vi } from "vitest";
import type { Article } from "../src/models/article.js";
import type { RankingAssessment } from "../src/models/ranking-assessment.js";
import {
  AiBriefingCandidateRanker,
  type AiRankingServicePort
} from "../src/services/ai-briefing-candidate-ranker.js";

describe("AiBriefingCandidateRanker", () => {
  it("orders by significance, confidence, and original order", async () => {
    const candidates = [
      makeArticle("first"),
      makeArticle("second"),
      makeArticle("third"),
      makeArticle("fourth")
    ];
    const service = makeService([
      makeAssessment("fourth", 0.9, 0.8),
      makeAssessment("third", 0.9, 0.8),
      makeAssessment("second", 0.9, 0.5),
      makeAssessment("first", 0.4, 1)
    ]);

    const result = await new AiBriefingCandidateRanker(service, 4).rank(
      candidates
    );

    expect(result.map(({ id }) => id)).toEqual([
      "third",
      "fourth",
      "second",
      "first"
    ]);
  });

  it("submits only the configured batch and appends exclusions unchanged", async () => {
    const candidates = [
      makeArticle("first"),
      makeArticle("second"),
      makeArticle("third"),
      makeArticle("fourth")
    ];
    const service = makeService([
      makeAssessment("second", 0.9, 0.8),
      makeAssessment("first", 0.5, 0.8)
    ]);

    const result = await new AiBriefingCandidateRanker(service, 2).rank(
      candidates
    );

    expect(service.assess).toHaveBeenCalledTimes(1);
    expect(
      service.assess.mock.calls[0]![0].map((article: Article) => article.id)
    ).toEqual(["first", "second"]);
    expect(result.map(({ id }) => id)).toEqual([
      "second",
      "first",
      "third",
      "fourth"
    ]);
    expect(new Set(result.map(({ id }) => id)).size).toBe(candidates.length);
  });

  it("joins differently ordered assessments by article ID", async () => {
    const candidates = [makeArticle("first"), makeArticle("second")];
    const service = makeService([
      makeAssessment("second", 0.2, 0.8),
      makeAssessment("first", 0.9, 0.8)
    ]);

    const result = await new AiBriefingCandidateRanker(service, 2).rank(
      candidates
    );

    expect(result.map(({ id }) => id)).toEqual(["first", "second"]);
  });

  it("returns a new empty array without calling the service", async () => {
    const service = makeService([]);
    const candidates = Object.freeze([] as Article[]);

    const result = await new AiBriefingCandidateRanker(service, 3).rank(
      candidates
    );

    expect(result).toEqual([]);
    expect(result).not.toBe(candidates);
    expect(service.assess).not.toHaveBeenCalled();
  });

  it("does not mutate frozen candidates or article data", async () => {
    const first = Object.freeze(makeArticle("first"));
    const second = Object.freeze(makeArticle("second"));
    const candidates = Object.freeze([first, second]);
    const snapshot = JSON.stringify(candidates);
    const service = makeService([
      makeAssessment("second", 0.9, 0.8),
      makeAssessment("first", 0.5, 0.8)
    ]);

    const result = await new AiBriefingCandidateRanker(service, 2).rank(
      candidates
    );

    expect(JSON.stringify(candidates)).toBe(snapshot);
    expect(result[0]).toBe(second);
    expect(result[1]).toBe(first);
    expect(result).not.toBe(candidates);
  });

  it("rejects invalid candidate limits", () => {
    const service = makeService([]);

    for (const limit of [0, 1.5, 51]) {
      expect(() => new AiBriefingCandidateRanker(service, limit)).toThrow(
        "must be an integer from 1 to 50"
      );
    }
  });

  it("propagates AI service errors", async () => {
    const failure = new Error("AI ranking unavailable");
    const service: AiRankingServicePort & {
      assess: ReturnType<typeof vi.fn>;
    } = {
      assess: vi.fn().mockRejectedValue(failure)
    };

    await expect(
      new AiBriefingCandidateRanker(service, 3).rank([makeArticle("first")])
    ).rejects.toBe(failure);
  });

  it("rejects missing, duplicate, and unknown assessment joins", async () => {
    const candidates = [makeArticle("first"), makeArticle("second")];

    await expect(
      new AiBriefingCandidateRanker(
        makeService([makeAssessment("first", 0.5, 0.5)]),
        2
      ).rank(candidates)
    ).rejects.toThrow('no assessment for article ID "second"');

    await expect(
      new AiBriefingCandidateRanker(
        makeService([
          makeAssessment("first", 0.5, 0.5),
          makeAssessment("first", 0.6, 0.6)
        ]),
        2
      ).rank(candidates)
    ).rejects.toThrow('duplicate assessment for article ID "first"');

    await expect(
      new AiBriefingCandidateRanker(
        makeService([
          makeAssessment("first", 0.5, 0.5),
          makeAssessment("unknown", 0.6, 0.6)
        ]),
        2
      ).rank(candidates)
    ).rejects.toThrow('unknown article ID "unknown"');
  });
});

function makeService(assessments: RankingAssessment[]): AiRankingServicePort & {
  assess: ReturnType<typeof vi.fn>;
} {
  return {
    assess: vi.fn().mockResolvedValue(assessments)
  };
}

function makeArticle(id: string): Article {
  return {
    id,
    title: `${id} headline`,
    url: `https://example.com/${id}`,
    source: "Example News",
    publishedAt: new Date("2026-07-28T01:00:00.000Z"),
    description: `${id} description`,
    content: `${id} content`,
    importanceScore: 0.5
  };
}

function makeAssessment(
  articleId: string,
  significanceScore: number,
  confidenceScore: number
): RankingAssessment {
  return {
    articleId,
    significanceScore,
    confidenceScore,
    rationale: "Test rationale."
  };
}
