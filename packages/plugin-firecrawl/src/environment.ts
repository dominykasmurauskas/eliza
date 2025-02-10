import { z } from "zod";
import { IAgentRuntime } from "@elizaos/core";

export const FirecrawlConfig = z.object({
    FIRECRAWL_API_KEY: z.string(),
    CRAWL_COOLDOWN: z.number().default(24 * 60 * 60 * 1000), // Default 24 hours in milliseconds
    CRAWL_CONCURRENCY: z.number().default(1),
    CRAWL_MAX_PAGES: z.number().default(2),
});

export type FirecrawlConfig = z.infer<typeof FirecrawlConfig>;

export async function validateFirecrawlConfig(
    runtime: IAgentRuntime
): Promise<FirecrawlConfig> {
    const config = {
        FIRECRAWL_API_KEY: runtime.getSetting("FIRECRAWL_API_KEY"),
        CRAWL_COOLDOWN: Number(runtime.getSetting("CRAWL_COOLDOWN") || "86400000"),
        CRAWL_CONCURRENCY: Number(runtime.getSetting("CRAWL_CONCURRENCY") || "1"),
        CRAWL_MAX_PAGES: Number(runtime.getSetting("CRAWL_MAX_PAGES") || "2"),
    };

    return FirecrawlConfig.parse(config);
}