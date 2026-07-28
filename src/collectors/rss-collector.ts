import { createHash } from "node:crypto";
import Parser from "rss-parser";
import type { RssFeedConfig } from "../config/rss-feeds.js";
import type { NewsCollector } from "./news-collector.js";
import {
  ARTICLE_CONTENT_MAX_LENGTH,
  ARTICLE_DESCRIPTION_MAX_LENGTH,
  ARTICLE_TITLE_MAX_LENGTH,
  ArticleSchema,
  type Article
} from "../models/article.js";
import type { Logger } from "../utils/logger.js";
import { cleanRssText } from "../utils/text-cleaner.js";
import { normaliseArticleUrl } from "../utils/url-normaliser.js";

interface RssCustomItemFields {
  rawPublicationDate?: string;
  rawPublishedDate?: string;
  rawUpdatedDate?: string;
}

type RssParserOutput = Parser.Output<RssCustomItemFields>;

export interface RssParserClient {
  parseURL(feedUrl: string): Promise<RssParserOutput>;
}

type RssCollectorLogger = Pick<Logger, "debug" | "warn">;

const silentLogger: RssCollectorLogger = {
  debug: () => undefined,
  warn: () => undefined
};

interface FeedCollectionResult {
  articles: Article[];
  failed: boolean;
}

export class AllRssFeedsFailedError extends Error {
  public constructor(public readonly failedFeedCount: number) {
    super(`All ${failedFeedCount} configured RSS feeds failed`);
    this.name = "AllRssFeedsFailedError";
  }
}

export class RssCollector implements NewsCollector {
  private readonly parser: RssParserClient;
  private readonly logger: RssCollectorLogger;

  public constructor(
    private readonly feeds: RssFeedConfig[],
    options: { parser?: RssParserClient; logger?: RssCollectorLogger } = {}
  ) {
    this.parser =
      options.parser ??
      new Parser<Record<string, unknown>, RssCustomItemFields>({
        timeout: 10000,
        headers: {
          "User-Agent": "MorningBriefAI/0.1 (+https://example.com)"
        },
        customFields: {
          item: [
            ["pubDate", "rawPublicationDate"],
            ["published", "rawPublishedDate"],
            ["updated", "rawUpdatedDate"]
          ]
        }
      });
    this.logger = options.logger ?? silentLogger;
  }

  public async collect(startTime: Date, endTime: Date): Promise<Article[]> {
    const results = await Promise.all(
      this.feeds.map((feed) => this.collectFeed(feed, startTime, endTime))
    );
    const failedFeedCount = results.filter((result) => result.failed).length;

    if (this.feeds.length > 0 && failedFeedCount === this.feeds.length) {
      throw new AllRssFeedsFailedError(failedFeedCount);
    }

    return results.flatMap((result) => result.articles);
  }

  private async collectFeed(
    feed: RssFeedConfig,
    startTime: Date,
    endTime: Date
  ): Promise<FeedCollectionResult> {
    let parsedFeed: RssParserOutput;

    try {
      parsedFeed = await this.parser.parseURL(feed.url);
      if (!Array.isArray(parsedFeed.items)) {
        throw new Error("RSS parser returned no item list");
      }
    } catch (error) {
      this.logger.warn("RSS feed failed", {
        feed: feed.name,
        url: feed.url,
        error: getErrorMessage(error)
      });
      return { articles: [], failed: true };
    }

    const articles: Article[] = [];

    for (const item of parsedFeed.items) {
      try {
        const article = this.normaliseItem(item, feed, startTime, endTime);

        if (article) {
          articles.push(article);
        }
      } catch (error) {
        this.warnInvalidEntry(feed, "unexpected item shape", {
          error: getErrorMessage(error)
        });
      }
    }

    this.logger.debug("Collected RSS feed", {
      feed: feed.name,
      items: parsedFeed.items.length,
      articles: articles.length
    });

    return { articles, failed: false };
  }

  private normaliseItem(
    item: Parser.Item & RssCustomItemFields,
    feed: RssFeedConfig,
    startTime: Date,
    endTime: Date
  ): Article | null {
    const title = cleanRssText(item.title, ARTICLE_TITLE_MAX_LENGTH);
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

    const parsedArticle = ArticleSchema.safeParse({
      id: createStableArticleId(url),
      title,
      url,
      source: feed.name,
      publishedAt,
      description: cleanRssText(
        item.contentSnippet ?? item.summary,
        ARTICLE_DESCRIPTION_MAX_LENGTH
      ),
      content: cleanRssText(item.content, ARTICLE_CONTENT_MAX_LENGTH),
      category: feed.category,
      credibilityScore: feed.defaultCredibilityScore
    });

    if (!parsedArticle.success) {
      this.warnInvalidEntry(feed, "article schema validation failed", {
        title,
        url,
        issues: parsedArticle.error.issues
      });
      return null;
    }

    return parsedArticle.data;
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

function parsePublicationDate(
  item: Parser.Item & RssCustomItemFields
): Date | null {
  const dateText =
    item.rawPublicationDate ??
    item.rawPublishedDate ??
    item.rawUpdatedDate ??
    item.pubDate ??
    item.isoDate;

  if (!dateText || !hasExplicitTimezone(dateText)) {
    return null;
  }

  const date = new Date(dateText);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasExplicitTimezone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2}|UT|UTC|GMT|[ECMP][SD]T)$/i.test(value.trim());
}

function isWithinWindow(value: Date, startTime: Date, endTime: Date): boolean {
  const timestamp = value.getTime();
  return timestamp >= startTime.getTime() && timestamp <= endTime.getTime();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
