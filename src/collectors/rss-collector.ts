import axios, { type AxiosInstance } from "axios";
import Parser from "rss-parser";
import type { NewsCollector } from "./news-collector.js";
import type { Article } from "../models/article.js";

export class RssCollector implements NewsCollector {
  private readonly parser: Parser;
  private readonly httpClient: AxiosInstance;

  public constructor(options: { parser?: Parser; httpClient?: AxiosInstance } = {}) {
    this.parser = options.parser ?? new Parser();
    this.httpClient = options.httpClient ?? axios.create();
  }

  public async collect(_startTime: Date, _endTime: Date): Promise<Article[]> {
    // Future implementation:
    // 1. Load configured RSS feed URLs.
    // 2. Fetch feed XML using the injected HTTP client.
    // 3. Parse feed items with rss-parser.
    // 4. Normalize items into Article records.
    // 5. Leave filtering and ranking to services so this collector is replaceable.
    void this.parser;
    void this.httpClient;
    return [];
  }
}
