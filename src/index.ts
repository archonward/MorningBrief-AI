import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { RssCollector } from "./collectors/rss-collector.js";
import { rssFeeds } from "./config/rss-feeds.js";
import { loadSettings } from "./config/settings.js";
import { ConsoleDelivery } from "./delivery/console-delivery.js";
import { FileArticleRepository } from "./repositories/article-repository.js";
import { ArticleFilter } from "./services/article-filter.js";
import { ArticleRanker } from "./services/article-ranker.js";
import { BriefingGenerator } from "./services/briefing-generator.js";
import { HeadlineDeduplicator } from "./services/headline-deduplicator.js";
import { Summariser } from "./services/summariser.js";
import { createLogger } from "./utils/logger.js";

export async function main(): Promise<void> {
  const settings = loadSettings();
  const logger = createLogger(settings.logLevel);

  logger.info("Starting MorningBrief AI", {
    timezone: settings.userTimezone,
    briefingHour: settings.briefingHour,
    lookbackHours: settings.newsLookbackHours
  });

  const { startTime, endTime } = calculateNewsWindow(
    settings.newsLookbackHours,
    new Date(),
    settings.userTimezone,
    settings.briefingHour
  );

  logger.info("Calculated overnight news window", {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString()
  });
  logger.info("Configured RSS feeds", { count: rssFeeds.length });

  const collector = new RssCollector(rssFeeds, { logger });
  const repository = new FileArticleRepository(
    resolve("data", "processed-articles.json")
  );
  const filter = new ArticleFilter(repository);
  const ranker = new ArticleRanker();
  const headlineDeduplicator = new HeadlineDeduplicator();
  const summariser = new Summariser();
  const briefingGenerator = new BriefingGenerator(
    summariser,
    settings.maxBriefingItems
  );
  const delivery = new ConsoleDelivery();

  const articles = await collector.collect(startTime, endTime);
  logger.info("Collected RSS articles", { count: articles.length });

  const filteredArticles = await filter.filter(articles, startTime, endTime);
  logger.info("Filtered articles", { count: filteredArticles.length });

  const rankedArticles = ranker.rank(filteredArticles, endTime);
  const briefingCandidates = headlineDeduplicator.deduplicate(rankedArticles);
  logger.info("Deduplicated matching headlines", {
    before: rankedArticles.length,
    after: briefingCandidates.length
  });
  const briefing = await briefingGenerator.generate(
    briefingCandidates,
    startTime,
    endTime
  );
  logger.info("Generated briefing", { items: briefing.items.length });

  await delivery.deliver(briefing);

  const deliveredArticles = briefingCandidates.slice(0, briefing.items.length);
  for (const article of deliveredArticles) {
    await repository.saveProcessedArticle(article);
  }
  logger.info("Recorded processed articles", { count: deliveredArticles.length });
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
