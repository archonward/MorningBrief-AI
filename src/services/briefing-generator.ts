import type { Article } from "../models/article.js";
import {
  MorningBriefingSchema,
  type MorningBriefing
} from "../models/briefing.js";
import { Summariser } from "./summariser.js";

export class BriefingGenerator {
  public constructor(
    private readonly summariser: Summariser,
    private readonly maxItems = 5
  ) {}

  public async generate(
    rankedArticles: Article[],
    timeWindowStart: Date,
    timeWindowEnd: Date
  ): Promise<MorningBriefing> {
    const selectedArticles = rankedArticles.slice(0, Math.min(this.maxItems, 5));
    const items = await Promise.all(
      selectedArticles.map((article) => this.summariser.summarise(article))
    );

    return MorningBriefingSchema.parse({
      generatedAt: new Date(),
      timeWindowStart,
      timeWindowEnd,
      items
    });
  }
}
