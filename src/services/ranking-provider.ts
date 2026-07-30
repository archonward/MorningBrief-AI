import type { RankingRequest } from "../models/ranking-request.js";

export interface RankingProvider {
  rank(request: RankingRequest): Promise<unknown>;
}
