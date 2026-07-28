import type { Article } from "../models/article.js";
import type { BriefingItem } from "../models/briefing.js";

export class Summariser {
  public async summarise(article: Article): Promise<BriefingItem> {
    // Future implementation will call an LLM with the version-controlled prompt.
    // For now, return deterministic placeholder text without external services.
    return {
      headline: article.title,
      summary:
        article.description ??
        "Placeholder summary. AI summarisation has not been enabled yet.",
      whyItMatters:
        "Placeholder significance note. Importance analysis will be added in a later phase.",
      source: article.source,
      url: article.url,
      publishedAt: article.publishedAt
    };
  }
}
