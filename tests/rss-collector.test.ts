import type Parser from "rss-parser";
import { describe, expect, it } from "vitest";
import type { RssFeedConfig } from "../src/config/rss-feeds.js";
import { RssCollector, type RssParserClient } from "../src/collectors/rss-collector.js";

describe("RssCollector", () => {
  const startTime = new Date("2026-07-27T22:00:00.000Z");
  const endTime = new Date("2026-07-28T08:00:00.000Z");

  it("converts a valid RSS item into an Article", async () => {
    const collector = new RssCollector([feedConfig()], {
      parser: parserWithFeeds({
        "https://example.com/feed.xml": [
          {
            title: "Important development",
            link: "https://example.com/story?utm_source=rss",
            isoDate: "2026-07-28T02:00:00.000Z",
            contentSnippet: "<p>Short &amp; useful summary.</p>",
            content: "<div>Full RSS content</div>"
          }
        ]
      })
    });

    const result = await collector.collect(startTime, endTime);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: "Important development",
      url: "https://example.com/story",
      source: "Example Feed",
      category: "world",
      credibilityScore: 0.8,
      description: "Short & useful summary.",
      content: "Full RSS content"
    });
    expect(result[0]?.id).toHaveLength(64);
    expect(result[0]?.publishedAt.toISOString()).toBe("2026-07-28T02:00:00.000Z");
  });

  it("excludes entries outside the requested time window", async () => {
    const collector = new RssCollector([feedConfig()], {
      parser: parserWithFeeds({
        "https://example.com/feed.xml": [
          {
            title: "Old story",
            link: "https://example.com/old",
            isoDate: "2026-07-27T12:00:00.000Z"
          }
        ]
      })
    });

    await expect(collector.collect(startTime, endTime)).resolves.toEqual([]);
  });

  it("excludes entries with no valid publication date", async () => {
    const collector = new RssCollector([feedConfig()], {
      parser: parserWithFeeds({
        "https://example.com/feed.xml": [
          {
            title: "Undated story",
            link: "https://example.com/undated",
            pubDate: "not a date"
          }
        ]
      })
    });

    await expect(collector.collect(startTime, endTime)).resolves.toEqual([]);
  });

  it("excludes entries with invalid URLs", async () => {
    const collector = new RssCollector([feedConfig()], {
      parser: parserWithFeeds({
        "https://example.com/feed.xml": [
          {
            title: "Bad URL story",
            link: "not a url",
            isoDate: "2026-07-28T02:00:00.000Z"
          }
        ]
      })
    });

    await expect(collector.collect(startTime, endTime)).resolves.toEqual([]);
  });

  it("keeps collecting when one feed fails", async () => {
    const successfulFeed = feedConfig({
      name: "Successful Feed",
      url: "https://example.com/success.xml"
    });
    const failedFeed = feedConfig({
      name: "Failed Feed",
      url: "https://example.com/fail.xml"
    });
    const collector = new RssCollector([failedFeed, successfulFeed], {
      parser: parserWithFeeds(
        {
          "https://example.com/success.xml": [
            {
              title: "Successful story",
              link: "https://example.com/success",
              isoDate: "2026-07-28T02:00:00.000Z"
            }
          ]
        },
        new Set(["https://example.com/fail.xml"])
      )
    });

    const result = await collector.collect(startTime, endTime);

    expect(result.map((article) => article.title)).toEqual(["Successful story"]);
  });

  it("creates the same stable ID for equivalent tracking URLs", async () => {
    const collector = new RssCollector([feedConfig()], {
      parser: parserWithFeeds({
        "https://example.com/feed.xml": [
          {
            title: "Tracked story",
            link: "https://example.com/story?id=123&utm_campaign=morning",
            isoDate: "2026-07-28T02:00:00.000Z"
          },
          {
            title: "Same tracked story",
            link: "https://example.com/story?id=123&utm_source=rss#section",
            isoDate: "2026-07-28T03:00:00.000Z"
          }
        ]
      })
    });

    const result = await collector.collect(startTime, endTime);

    expect(result).toHaveLength(2);
    expect(result[0]?.url).toBe("https://example.com/story?id=123");
    expect(result[1]?.url).toBe("https://example.com/story?id=123");
    expect(result[0]?.id).toBe(result[1]?.id);
  });
});

function feedConfig(overrides: Partial<RssFeedConfig> = {}): RssFeedConfig {
  return {
    name: "Example Feed",
    url: "https://example.com/feed.xml",
    category: "world",
    defaultCredibilityScore: 0.8,
    ...overrides
  };
}

function parserWithFeeds(
  itemsByUrl: Record<string, Parser.Item[]>,
  failedUrls = new Set<string>()
): RssParserClient {
  return {
    async parseURL(feedUrl: string): Promise<Parser.Output<Record<string, unknown>>> {
      if (failedUrls.has(feedUrl)) {
        throw new Error("Feed unavailable");
      }

      return {
        items: itemsByUrl[feedUrl] ?? []
      };
    }
  };
}
