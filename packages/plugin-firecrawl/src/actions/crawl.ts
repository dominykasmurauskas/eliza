import {
    Action,
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    elizaLogger,
    ServiceType,
    stringToUuid
} from "@elizaos/core";
import { CrawlerService } from "../services/crawler";

export const crawlAction: Action = {
    name: "crawl",
    similes: ["FETCH_WEBSITE", "SCRAPE", "GET_WEBSITE_CONTENT"],
    description: "Add a crawl task to the queue if the user mentions a website",

    validate: async (runtime: IAgentRuntime, _message: Memory): Promise<boolean> => {
        const apiKey = runtime.getSetting("FIRECRAWL_API_KEY");
        const isConfigured = !!apiKey;
        elizaLogger.info("Crawl action validate", {
            isConfigured,
            roomId: _message.roomId,
            crawlerInternalRoomId: stringToUuid('crawler-internal')
        });

        return isConfigured && _message.roomId !== stringToUuid('crawler-internal');
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: { [key: string]: unknown },
        callback: HandlerCallback
    ) => {
        try {
            elizaLogger.info("Handling crawl action");
            const crawler = await runtime.getService<CrawlerService>(ServiceType.CRAWLER);

            try {
                crawler.crawlFromMemory(message);
            } catch (crawlError) {
                elizaLogger.error('Error crawling', {
                    error: crawlError,
                    errorMessage: crawlError.message,
                    stack: crawlError.stack,
                });
                throw crawlError;
            }

            return true;
        } catch (error) {
            elizaLogger.error({
                error,
                errorMessage: error.message,
                stack: error.stack,
                type: error.constructor.name
            }, "Error in crawl action");
            callback({ text: `Unfortunately, I couldn't crawl the website: ${error.message}` });

            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Can you crawl this website for me? https://example.com" },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll crawl the website and store its content for future reference.",
                    action: "CRAWL"
                },
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Please analyze the content from https://docs.example.com/api" },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll extract and analyze the content from the documentation website.",
                    action: "CRAWL"
                },
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Get the content from this page: https://example.com/docs" },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll fetch and store the content from that page.",
                    action: "CRAWL"
                },
            }
        ]
    ] as ActionExample[][]
} as Action;