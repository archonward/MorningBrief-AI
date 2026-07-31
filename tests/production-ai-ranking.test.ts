import { describe, expect, it, vi } from "vitest";
import type { Settings } from "../src/config/settings.js";
import {
  createProductionAiCandidateRanker,
  runProductionBriefing,
  type BriefingCandidateRankerPort,
  type BriefingDeliveryPort,
  type BriefingGeneratorPort
} from "../src/index.js";
import type { Article } from "../src/models/article.js";
import type { MorningBriefing } from "../src/models/briefing.js";
import type { ArticleRepository } from "../src/repositories/article-repository.js";
import type { Logger } from "../src/utils/logger.js";

describe("production AI ranking wiring", () => {
  it("does not load the prompt or construct a client when disabled", async () => {
    const promptLoader = vi.fn();
    const clientFactory = vi.fn();

    const ranker = await createProductionAiCandidateRanker(
      makeSettings({ aiRankingEnabled: false }),
      { promptLoader, clientFactory }
    );

    expect(ranker).toBeUndefined();
    expect(promptLoader).not.toHaveBeenCalled();
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("uses AI-reordered candidates for generation and delivered persistence", async () => {
    const first = makeArticle("first", 0.9);
    const second = makeArticle("second", 0.8);
    const third = makeArticle("third", 0.7);
    const repository = makeRepository();
    const briefingGenerator = makeBriefingGenerator(2);
    const delivery = makeDelivery();
    const aiCandidateRanker: BriefingCandidateRankerPort = {
      rank: vi.fn().mockImplementation(async (candidates: readonly Article[]) => [
        candidates[1]!,
        candidates[0]!,
        candidates[2]!
      ])
    };

    await runProductionBriefing({
      settings: makeSettings({
        aiRankingEnabled: true,
        openAiApiKey: "sk-test",
        openAiRankingModel: "gpt-ranking",
        aiRankingMaxCandidates: 3
      }),
      logger: makeLogger(),
      collector: {
        collect: vi.fn().mockResolvedValue([first, second, third])
      },
      repository,
      briefingGenerator,
      delivery,
      aiCandidateRanker,
      now: new Date("2026-07-28T03:30:00.000Z")
    });

    expect(aiCandidateRanker.rank).toHaveBeenCalledTimes(1);
    expect(getGeneratedIds(briefingGenerator)).toEqual([
      "second",
      "first",
      "third"
    ]);
    expect(
      repository.saveProcessedArticle.mock.calls.map(
        ([article]: [Article]) => article.id
      )
    ).toEqual(["second", "first"]);
    expect(delivery.deliver).toHaveBeenCalledTimes(1);
  });

  it("uses deterministic candidates without an AI dependency when disabled", async () => {
    const repository = makeRepository();
    const briefingGenerator = makeBriefingGenerator(2);

    await runProductionBriefing({
      settings: makeSettings({ aiRankingEnabled: false }),
      logger: makeLogger(),
      collector: {
        collect: vi.fn().mockResolvedValue([
          makeArticle("first", 0.9),
          makeArticle("second", 0.8)
        ])
      },
      repository,
      briefingGenerator,
      delivery: makeDelivery(),
      now: new Date("2026-07-28T03:30:00.000Z")
    });

    expect(getGeneratedIds(briefingGenerator)).toEqual(["first", "second"]);
    expect(repository.saveProcessedArticle).toHaveBeenCalledTimes(2);
  });

  it("prevents generation, delivery, and persistence when AI ranking fails", async () => {
    const failure = new Error("AI response validation failed");
    const repository = makeRepository();
    const briefingGenerator = makeBriefingGenerator(1);
    const delivery = makeDelivery();

    await expect(
      runProductionBriefing({
        settings: makeSettings({
          aiRankingEnabled: true,
          openAiApiKey: "sk-test",
          openAiRankingModel: "gpt-ranking"
        }),
        logger: makeLogger(),
        collector: {
          collect: vi.fn().mockResolvedValue([makeArticle("first", 0.9)])
        },
        repository,
        briefingGenerator,
        delivery,
        aiCandidateRanker: {
          rank: vi.fn().mockRejectedValue(failure)
        },
        now: new Date("2026-07-28T03:30:00.000Z")
      })
    ).rejects.toBe(failure);

    expect(briefingGenerator.generate).not.toHaveBeenCalled();
    expect(delivery.deliver).not.toHaveBeenCalled();
    expect(repository.saveProcessedArticle).not.toHaveBeenCalled();
  });
});

function makeSettings(overrides: Partial<Settings>): Settings {
  return {
    userTimezone: "Asia/Singapore",
    briefingHour: 8,
    newsLookbackHours: 10,
    maxBriefingItems: 5,
    logLevel: "error",
    aiRankingEnabled: false,
    aiRankingMaxCandidates: 20,
    ...overrides
  };
}

function makeArticle(id: string, importanceScore: number): Article {
  return {
    id,
    title: `${id} headline`,
    url: `https://example.com/${id}`,
    source: "Example News",
    publishedAt: new Date("2026-07-27T23:00:00.000Z"),
    description: `${id} description`,
    importanceScore
  };
}

function makeRepository(): ArticleRepository & {
  hasProcessedUrl: ReturnType<typeof vi.fn>;
  saveProcessedArticle: ReturnType<typeof vi.fn>;
  getRecentProcessedUrls: ReturnType<typeof vi.fn>;
} {
  return {
    hasProcessedUrl: vi.fn().mockResolvedValue(false),
    saveProcessedArticle: vi.fn().mockResolvedValue(undefined),
    getRecentProcessedUrls: vi.fn().mockResolvedValue([])
  };
}

function makeBriefingGenerator(itemCount: number): BriefingGeneratorPort & {
  generate: ReturnType<typeof vi.fn>;
} {
  return {
    generate: vi.fn().mockImplementation(
      async (
        candidates: Article[],
        timeWindowStart: Date,
        timeWindowEnd: Date
      ): Promise<MorningBriefing> => ({
        generatedAt: new Date("2026-07-28T03:30:00.000Z"),
        timeWindowStart,
        timeWindowEnd,
        items: candidates.slice(0, itemCount).map((article) => ({
          headline: article.title,
          summary: article.description ?? "Description unavailable.",
          whyItMatters: "Test significance.",
          source: article.source,
          url: article.url,
          publishedAt: article.publishedAt
        }))
      })
    )
  };
}

function makeDelivery(): BriefingDeliveryPort & {
  deliver: ReturnType<typeof vi.fn>;
} {
  return {
    deliver: vi.fn().mockResolvedValue(undefined)
  };
}

function makeLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

function getGeneratedIds(
  briefingGenerator: BriefingGeneratorPort & {
    generate: ReturnType<typeof vi.fn>;
  }
): string[] {
  return briefingGenerator.generate.mock.calls[0]![0].map(
    (article: Article) => article.id
  );
}
