import type { Article } from "../models/article.js";

export interface NewsCollector {
  collect(startTime: Date, endTime: Date): Promise<Article[]>;
}
