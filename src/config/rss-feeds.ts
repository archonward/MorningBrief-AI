export interface RssFeedConfig {
  name: string;
  url: string;
  category: string;
  defaultCredibilityScore: number;
}

function createFeed(config: RssFeedConfig): RssFeedConfig {
  const name = config.name.trim();
  const category = config.category.trim();
  const url = parseHttpUrl(config.url);

  if (!name) {
    throw new Error("RSS feed name must not be empty");
  }

  if (!category) {
    throw new Error(`RSS feed category must not be empty for ${name}`);
  }

  if (
    !Number.isFinite(config.defaultCredibilityScore) ||
    config.defaultCredibilityScore < 0 ||
    config.defaultCredibilityScore > 1
  ) {
    throw new Error(`Invalid RSS credibility score for ${name}`);
  }

  return {
    ...config,
    name,
    category,
    url
  };
}

function parseHttpUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    return url.toString();
  } catch {
    throw new Error(`Invalid RSS feed URL: ${value}`);
  }
}

// These scores are configurable application defaults, not objective measures of truth.
export const rssFeeds: RssFeedConfig[] = [
  createFeed({
    name: "BBC News - World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    category: "international",
    defaultCredibilityScore: 0.9
  }),
  createFeed({
    name: "CNA - Singapore",
    url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416",
    category: "singapore",
    defaultCredibilityScore: 0.85
  }),
  createFeed({
    name: "BBC News - Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    category: "business",
    defaultCredibilityScore: 0.9
  }),
  createFeed({
    name: "BBC News - Technology",
    url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    category: "technology",
    defaultCredibilityScore: 0.88
  }),
  createFeed({
    name: "The Guardian - Science",
    url: "https://www.theguardian.com/science/rss",
    category: "science",
    defaultCredibilityScore: 0.82
  })
];
