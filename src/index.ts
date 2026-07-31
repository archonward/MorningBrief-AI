import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import OpenAI from "openai";
import type { NewsCollector } from "./collectors/news-collector.js";
import { RssCollector } from "./collectors/rss-collector.js";
import { rssFeeds } from "./config/rss-feeds.js";
import { loadSettings, type Settings } from "./config/settings.js";
import { ConsoleDelivery } from "./delivery/console-delivery.js";
import type { Article } from "./models/article.js";
import type { MorningBriefing } from "./models/briefing.js";
import {
  FileArticleRepository,
  type ArticleRepository
} from "./repositories/article-repository.js";
import { AiBriefingCandidateRanker } from "./services/ai-briefing-candidate-ranker.js";
import { AiRankingService } from "./services/ai-ranking-service.js";
import { ArticleFilter } from "./services/article-filter.js";
import { ArticleRanker } from "./services/article-ranker.js";
import { BriefingGenerator } from "./services/briefing-generator.js";
import { HeadlineDeduplicator } from "./services/headline-deduplicator.js";
import {
  OpenAiRankingProvider,
  type OpenAiRankingClient
} from "./services/openai-ranking-provider.js";
import { loadRankingPrompt } from "./services/ranking-prompt-loader.js";
import { Summariser } from "./services/summariser.js";
import { createLogger, type Logger } from "./utils/logger.js";

export interface BriefingGeneratorPort {
  generate(
    rankedArticles: Article[],
    timeWindowStart: Date,
    timeWindowEnd: Date
  ): Promise<MorningBriefing>;
}

export interface BriefingDeliveryPort {
  deliver(briefing: MorningBriefing): Promise<void>;
}

export interface BriefingCandidateRankerPort {
  rank(candidates: readonly Article[]): Promise<Article[]>;
}

export interface ProductionBriefingOptions {
  settings: Settings;
  logger: Logger;
  collector: NewsCollector;
  repository: ArticleRepository;
  briefingGenerator: BriefingGeneratorPort;
  delivery: BriefingDeliveryPort;
  aiCandidateRanker?: BriefingCandidateRankerPort;
  now?: Date;
}

export interface ProductionAiRankingFactories {
  promptLoader?: () => Promise<string>;
  clientFactory?: (apiKey: string) => OpenAiRankingClient;
}

export async function main(): Promise<void> {
  const settings = loadSettings();
  const logger = createLogger(settings.logLevel);

  logger.info("Starting MorningBrief AI", {
    timezone: settings.userTimezone,
    briefingHour: settings.briefingHour,
    lookbackHours: settings.newsLookbackHours
  });

  logger.info("Configured RSS feeds", { count: rssFeeds.length });

  const collector = new RssCollector(rssFeeds, { logger });
  const repository = new FileArticleRepository(
    resolve("data", "processed-articles.json")
  );
  const summariser = new Summariser();
  const briefingGenerator = new BriefingGenerator(
    summariser,
    settings.maxBriefingItems
  );
  const delivery = new ConsoleDelivery();
  const aiCandidateRanker = await createProductionAiCandidateRanker(settings);

  await runProductionBriefing({
    settings,
    logger,
    collector,
    repository,
    briefingGenerator,
    delivery,
    ...(aiCandidateRanker === undefined ? {} : { aiCandidateRanker })
  });
}

export async function createProductionAiCandidateRanker(
  settings: Settings,
  factories: ProductionAiRankingFactories = {}
): Promise<AiBriefingCandidateRanker | undefined> {
  if (!settings.aiRankingEnabled) {
    return undefined;
  }

  if (
    settings.openAiApiKey === undefined ||
    settings.openAiRankingModel === undefined
  ) {
    throw new Error(
      "Enabled production AI ranking requires OPENAI_API_KEY and OPENAI_RANKING_MODEL"
    );
  }

  const rankingPrompt = await (
    factories.promptLoader ?? loadRankingPrompt
  )();
  const client = (
    factories.clientFactory ??
    ((apiKey: string) => new OpenAI({ apiKey }))
  )(settings.openAiApiKey);
  const provider = new OpenAiRankingProvider(
    client,
    settings.openAiRankingModel,
    rankingPrompt
  );

  return new AiBriefingCandidateRanker(
    new AiRankingService(provider),
    settings.aiRankingMaxCandidates
  );
}

export async function runProductionBriefing(
  options: ProductionBriefingOptions
): Promise<void> {
  const now = options.now ?? new Date();
  const { startTime, endTime } = calculateNewsWindow(
    options.settings.newsLookbackHours,
    now,
    options.settings.userTimezone,
    options.settings.briefingHour
  );

  options.logger.info("Calculated overnight news window", {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString()
  });

  const articles = await options.collector.collect(startTime, endTime);
  options.logger.info("Collected RSS articles", { count: articles.length });

  const filter = new ArticleFilter(options.repository);
  const filteredArticles = await filter.filter(articles, startTime, endTime);
  options.logger.info("Filtered articles", { count: filteredArticles.length });

  const rankedArticles = new ArticleRanker().rank(filteredArticles, endTime);
  let briefingCandidates = new HeadlineDeduplicator().deduplicate(
    rankedArticles
  );
  options.logger.info("Deduplicated matching headlines", {
    before: rankedArticles.length,
    after: briefingCandidates.length
  });

  if (options.settings.aiRankingEnabled) {
    if (options.aiCandidateRanker === undefined) {
      throw new Error("AI ranking is enabled but no candidate ranker was provided");
    }

    const submitted = Math.min(
      briefingCandidates.length,
      options.settings.aiRankingMaxCandidates
    );
    options.logger.info("Applying AI ranking", {
      model: options.settings.openAiRankingModel,
      candidatesAvailable: briefingCandidates.length,
      candidatesSubmitted: submitted,
      candidatesExcluded: briefingCandidates.length - submitted
    });
    briefingCandidates =
      await options.aiCandidateRanker.rank(briefingCandidates);
    options.logger.info("AI ranking completed");
  } else {
    options.logger.info("AI ranking disabled; using deterministic ranking");
  }

  const briefing = await options.briefingGenerator.generate(
    briefingCandidates,
    startTime,
    endTime
  );
  options.logger.info("Generated briefing", { items: briefing.items.length });

  await options.delivery.deliver(briefing);

  const deliveredArticles = briefingCandidates.slice(0, briefing.items.length);
  for (const article of deliveredArticles) {
    await options.repository.saveProcessedArticle(article);
  }
  options.logger.info("Recorded processed articles", {
    count: deliveredArticles.length
  });
}

export function calculateNewsWindow(
  lookbackHours: number,
  now = new Date(),
  userTimezone = "Asia/Singapore",
  briefingHour = 8
): {
  startTime: Date;
  endTime: Date;
} {
  if (!Number.isInteger(lookbackHours) || lookbackHours < 1) {
    throw new Error("lookbackHours must be a positive integer");
  }
  if (!Number.isInteger(briefingHour) || briefingHour < 0 || briefingHour > 23) {
    throw new Error("briefingHour must be an integer from 0 to 23");
  }
  if (Number.isNaN(now.getTime())) {
    throw new Error("now must be a valid date");
  }

  const localNow = getZonedDateTimeParts(now, userTimezone);
  let localBriefingDate = {
    year: localNow.year,
    month: localNow.month,
    day: localNow.day
  };
  let endTime = zonedDateTimeToDate(
    { ...localBriefingDate, hour: briefingHour, minute: 0, second: 0 },
    userTimezone
  );

  if (endTime.getTime() > now.getTime()) {
    localBriefingDate = previousCalendarDate(localBriefingDate);
    endTime = zonedDateTimeToDate(
      { ...localBriefingDate, hour: briefingHour, minute: 0, second: 0 },
      userTimezone
    );
  }

  const startTime = new Date(endTime.getTime() - lookbackHours * 60 * 60 * 1000);

  return { startTime, endTime };
}

export function isMainModule(
  moduleUrl: string,
  entryPath: string | undefined = process.argv[1]
): boolean {
  return entryPath !== undefined && moduleUrl === pathToFileURL(resolve(entryPath)).href;
}

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

interface ZonedDateTimeParts extends CalendarDate {
  hour: number;
  minute: number;
  second: number;
}

function getZonedDateTimeParts(
  value: Date,
  timeZone: string
): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}

function zonedDateTimeToDate(
  desired: ZonedDateTimeParts,
  timeZone: string
): Date {
  const desiredWallTime = toUtcTimestamp(desired);
  let candidateTimestamp = desiredWallTime;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = getZonedDateTimeParts(new Date(candidateTimestamp), timeZone);
    const difference = desiredWallTime - toUtcTimestamp(actual);

    if (difference === 0) {
      return new Date(candidateTimestamp);
    }

    candidateTimestamp += difference;
  }

  throw new Error(
    `Could not resolve ${formatLocalDateTime(desired)} in timezone ${timeZone}`
  );
}

function previousCalendarDate(value: CalendarDate): CalendarDate {
  const previous = new Date(Date.UTC(value.year, value.month - 1, value.day - 1));
  return {
    year: previous.getUTCFullYear(),
    month: previous.getUTCMonth() + 1,
    day: previous.getUTCDate()
  };
}

function toUtcTimestamp(value: ZonedDateTimeParts): number {
  return Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    value.second
  );
}

function formatLocalDateTime(value: ZonedDateTimeParts): string {
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(
    value.day
  ).padStart(2, "0")} ${String(value.hour).padStart(2, "0")}:${String(
    value.minute
  ).padStart(2, "0")}:${String(value.second).padStart(2, "0")}`;
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`MorningBrief AI failed: ${message}`);
    process.exitCode = 1;
  });
}
