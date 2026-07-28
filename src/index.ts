import { RssCollector } from "./collectors/rss-collector.js";
import { loadSettings } from "./config/settings.js";
import { ConsoleDelivery } from "./delivery/console-delivery.js";
import { InMemoryArticleRepository } from "./repositories/article-repository.js";
import { ArticleFilter } from "./services/article-filter.js";
import { ArticleRanker } from "./services/article-ranker.js";
import { BriefingGenerator } from "./services/briefing-generator.js";
import { Summariser } from "./services/summariser.js";
import { createLogger } from "./utils/logger.js";

export async function main(): Promise<void> {
  const settings = loadSettings();
  const logger = createLogger(settings.logLevel);

  logger.info("Starting MorningBrief AI", {
    timezone: settings.userTimezone,
    lookbackHours: settings.newsLookbackHours
  });

  const { startTime, endTime } = calculateNewsWindow(settings.newsLookbackHours);
  const collector = new RssCollector();
  const repository = new InMemoryArticleRepository();
  const filter = new ArticleFilter(repository);
  const ranker = new ArticleRanker();
  const summariser = new Summariser();
  const briefingGenerator = new BriefingGenerator(
    summariser,
    settings.maxBriefingItems
  );
  const delivery = new ConsoleDelivery();

  const articles = await collector.collect(startTime, endTime);
  const filteredArticles = await filter.filter(articles, startTime, endTime);
  const rankedArticles = ranker.rank(filteredArticles, endTime);
  const briefing = await briefingGenerator.generate(
    rankedArticles,
    startTime,
    endTime
  );

  await delivery.deliver(briefing);
}

export function calculateNewsWindow(lookbackHours: number, now = new Date()): {
  startTime: Date;
  endTime: Date;
} {
  const endTime = now;
  const startTime = new Date(endTime.getTime() - lookbackHours * 60 * 60 * 1000);

  return { startTime, endTime };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`MorningBrief AI failed: ${message}`);
    process.exitCode = 1;
  });
}
