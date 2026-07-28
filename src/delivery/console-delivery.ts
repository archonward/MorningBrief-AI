import type { MorningBriefing } from "../models/briefing.js";

export class ConsoleDelivery {
  public async deliver(briefing: MorningBriefing): Promise<void> {
    console.log("");
    console.log("MorningBrief AI");
    console.log(`Generated: ${briefing.generatedAt.toISOString()}`);
    console.log(
      `Window: ${briefing.timeWindowStart.toISOString()} to ${briefing.timeWindowEnd.toISOString()}`
    );
    console.log("");

    if (briefing.items.length === 0) {
      console.log("No eligible articles were found for this briefing window.");
      return;
    }

    briefing.items.forEach((item, index) => {
      console.log(`${index + 1}. ${item.headline}`);
      console.log(`   Summary: ${item.summary}`);
      console.log(`   Why it matters: ${item.whyItMatters}`);
      console.log(`   Source: ${item.source}`);
      console.log(`   URL: ${item.url}`);
      console.log("");
    });
  }
}
