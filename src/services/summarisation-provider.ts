import type { SummarisationRequest } from "../models/summarisation-request.js";

export interface SummarisationProvider {
  summarise(request: SummarisationRequest): Promise<unknown>;
}
