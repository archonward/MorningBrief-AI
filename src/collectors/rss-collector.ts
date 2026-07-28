import { createHash } from "node:crypto";
import Parser from "rss-parser";
import type { RssFeedConfig } from "../config/rss-feeds.js";
import type { NewsCollector } from "./news-collector.js";
import type { Article } from "../models/article.js";
import type { Logger } from "../utils/logger.js";
import { cleanRssText } from "../utils/text-cleaner.js";
import { normaliseArticleUrl } from "../utils/url-normaliser.js";

type RssParserOutput = Parser.Output<Record<string, unknown>>;

export interface RssParserClient {
  parseURL(feedUrl: string): Promise<RssParserOutput>;
}

type RssCollectorLogger = Pick<Logger, "debug" | "warn">;

const silentLogger: RssCollectorLogger = {
  debug: () => undefined,
  warn: () => undefined
};

export class RssCollector implements NewsCollector {
  private readonly parser: RssParserClient;
  private readonly logger: RssCollectorLogger;

  public constructor(
    private readonly feeds: RssFeedConfig[],
    options: { parser?: RssParserClient; logger?: RssCollectorLogger } = {}
  ) {
    this.parser =
      options.parser ??
      new Parser({
        timeout: 10000,
        headers: {
          "User-Agent": "MorningBriefAI/0.1 (+https://example.com)"
        }
      });
    this.logger = options.logger ?? silentLogger;
  }

  public async collect(startTime: Date, endTime: Date): Promise<Article[]> {
    const results = await Promise.allSettled(
      this.feeds.map((feed) => this.collectFeed(feed, startTime, endTime))
    );

    return results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    );
  }

  private async collectFeed(
    feed: RssFeedConfig,
    startTime: Date,
    endTime: Date
  ): Promise<Article[]> {
    try {
      const parsedFeed = await this.parser.parseURL(feed.url);
      const articles: Article[] = [];

      for (const item of parsedFeed.items) {
        const article = this.normaliseItem(item, feed, startTime, endTime);

        if (article) {
          articles.push(article);
        }
      }

      this.logger.debug("Collected RSS feed", {
        feed: feed.name,
        items: parsedFeed.items.length,
        articles: articles.length
      });

      return articles;
    } catch (error) {
      this.logger.warn("RSS feed failed", {
        feed: feed.name,
        url: feed.url,
        error: getErrorMessage(error)
      });
      return [];
    }
  }

  private normaliseItem(
    item: Parser.Item,
    feed: RssFeedConfig,
    startTime: Date,
    endTime: Date
  ): Article | null {
    const title = item.title?.trim();
    if (!title) {
      this.warnInvalidEntry(feed, "missing title");
      return null;
    }

    const url = item.link ? normaliseArticleUrl(item.link) : null;
    if (!url) {
      this.warnInvalidEntry(feed, "invalid URL", { title });
      return null;
    }

    const publishedAt = parsePublicationDate(item);
    if (!publishedAt) {
      this.warnInvalidEntry(feed, "invalid publication date", { title, url });
      return null;
    }

    if (!isWithinWindow(publishedAt, startTime, endTime)) {
      return null;
    }

    return {
      id: createStableArticleId(url),
      title,
      url,
      source: feed.name,
      publishedAt,
      description: cleanRssText(item.contentSnippet ?? item.summary),
      content: cleanRssText(item.content),
      category: feed.category,
      credibilityScore: feed.defaultCredibilityScore
    };
  }

  private warnInvalidEntry(
    feed: RssFeedConfig,
    reason: string,
    details: Record<string, unknown> = {}
  ): void {
    this.logger.warn("Invalid RSS entry skipped", {
      feed: feed.name,
      reason,
      ...details
    });
  }
}

function createStableArticleId(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

function parsePublicationDate(item: Parser.Item): Date | null {
  const dateText = item.isoDate ?? item.pubDate;

  if (!dateText) {
    return null;
  }

  const date = new Date(dateText);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWithinWindow(value: Date, startTime: Date, endTime: Date): boolean {
  const timestamp = value.getTime();
  return timestamp >= startTime.getTime() && timestamp <= endTime.getTime();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
