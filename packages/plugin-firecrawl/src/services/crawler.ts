import { CrawlError, CrawlRecord, CrawlTask } from "../types";
import { elizaLogger, generateText, Service, ServiceType, stringToUuid } from '@elizaos/core';
import { IAgentRuntime, Memory } from '@elizaos/core';
import { MemoryMetadata, CrawlOptions, FirecrawlResult } from '../types';
import FirecrawlApp from '@mendable/firecrawl-js';
import PQueue from "p-queue";
import { validateFirecrawlConfig, type FirecrawlConfig } from "../environment";
import { extractContentTemplate } from '../prompts';
import { composeContext } from '@elizaos/core';
import { ModelClass } from '@elizaos/core';
import { UNWANTED_EXTENSIONS } from "../constants";
import URLParse from "url-parse";

export class CrawlerService extends Service {
    private runtime: IAgentRuntime;
    private queue: PQueue;
    private errors: Map<string, CrawlError>;
    private firecrawl: FirecrawlApp;
    private config: FirecrawlConfig;
    private initialized = false;

    public static get serviceType() {
        return ServiceType.CRAWLER;
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        if (this.initialized) {
            return;
        }

        this.runtime = runtime;
        this.config = await validateFirecrawlConfig(runtime);
        this.errors = new Map();
        this.queue = new PQueue({
            concurrency: this.config.CRAWL_CONCURRENCY
        });
        this.firecrawl = new FirecrawlApp({
            apiKey: this.config.FIRECRAWL_API_KEY
        });
        this.initialized = true;
    }

    public async crawlFromMemory(memory: Memory, options?: CrawlOptions): Promise<void> {
        // Skip if memory is from our own crawling
        const metadata = memory.content?.metadata as MemoryMetadata | undefined;
        if (metadata?.source === 'firecrawl') {
            return;
        }

        const urls = await this.shouldCrawl(memory);
        if (!urls) {
            return;
        }

        // Process each URL that the LLM determined should be crawled
        for (const url of urls) {
            await this.crawlUrl(url, this.determineSource(memory), options);
        }
    }

    public async shouldCrawl(memory: Memory): Promise<string[] | null> {
        const text = memory.content?.text || '';
        if (!text) {
            return null;
        }

        // Extract URLs using regex
        const urlRegex = /https?:\/\/[^\s]+/g;
        const matches = text.match(urlRegex) || [];
        const urls = [...new Set(matches)].filter(url => {
            try {
                const parsed = new URLParse(url);
                const path = parsed.pathname.toLowerCase();
                // Check if URL is valid and doesn't have unwanted extensions
                return (
                    (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
                    parsed.host.length > 0 &&
                    !UNWANTED_EXTENSIONS.some(ext => path.endsWith(ext))
                );
            } catch {
                return false;
            }
        });

        if (urls.length === 0) {
            return null;
        }

        return urls;
    }

    public async crawlUrl(url: string, source: CrawlTask['source'], options?: CrawlOptions): Promise<void> {
        let shouldCrawl = false;
        try {
            const parsed = new URLParse(url);
            const path = parsed.pathname.toLowerCase();

            shouldCrawl = !UNWANTED_EXTENSIONS.some(ext => path.endsWith(ext));
        } catch {
        }
        if (!shouldCrawl) {
            elizaLogger.info("Skipping URL due to unwanted extension", { url });
            return;
        }

        const task: CrawlTask = {
            url,
            source,
            retryCount: 0,
            maxRetries: 3,
            timestamp: Date.now(),
            ...options
        };

        await this.addTask(task);
    }

    private async addTask(task: CrawlTask): Promise<void> {
        const normalizedUrl = this.normalizeUrl(task.url);

        // Check if URL was recently crawled
        const options = task as CrawlOptions;
        if (!options.forceCrawl) {
          const existingRecord = await this.getCrawlRecord(normalizedUrl);
          if (existingRecord && this.isRecordValid(existingRecord)) {
            return;
          }
        }

        elizaLogger.info("Adding crawl task to queue", task);

        // Add to queue and process immediately
        await this.queue.add(() => this.processCrawlTask(task));
    }

    private normalizeUrl(url: string): string {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.toLowerCase();
    }

    private async getCrawlRecord(normalizedUrl: string): Promise<CrawlRecord | null> {
        const records = await this.runtime.ragKnowledgeManager.getKnowledge({
          query: normalizedUrl,
          agentId: this.runtime.agentId
        });

        return records.length > 0 ? records[0] as unknown as CrawlRecord : null;
    }

    private isRecordValid(record: CrawlRecord): boolean {
        // Check if the record is recent enough (within cooldown period)
        const age = Date.now() - record.lastCrawled;
        return age < this.config.CRAWL_COOLDOWN && record.success;
    }

    private async processCrawlTask(task: CrawlTask): Promise<void> {
        const normalizedUrl = this.normalizeUrl(task.url);

        try {
            elizaLogger.info("Starting crawl task", {
                url: task.url,
                retryCount: task.retryCount
            });

            const results = await this.firecrawlUrl(task);
            elizaLogger.info("Crawl successful", {
                url: task.url,
                resultsCount: results.length
            });

            await this.saveToRagKnowledge(results, task);
            elizaLogger.info("Saved to RAG knowledge", {
                url: task.url,
                resultsCount: results.length
            });

            // Save crawl record
            await this.saveCrawlRecord({
                url: task.url,
                normalizedUrl,
                lastCrawled: Date.now(),
                source: task.source,
                success: true
            });
        } catch (error) {
            const errorInfo: CrawlError = {
                url: task.url,
                error: error.message,
                timestamp: Date.now(),
                retryCount: task.retryCount
            };

            elizaLogger.error("Crawl task failed", {
                ...errorInfo,
                willRetry: task.retryCount < task.maxRetries
            });

            this.errors.set(task.url, errorInfo);

            // Save failed crawl record
            await this.saveCrawlRecord({
                url: task.url,
                normalizedUrl,
                lastCrawled: Date.now(),
                source: task.source,
                success: false,
                error: error.message
            });

            if (task.retryCount < task.maxRetries) {
                elizaLogger.info("Scheduling retry", {
                    url: task.url,
                    currentRetry: task.retryCount,
                    maxRetries: task.maxRetries,
                    nextRetryNumber: task.retryCount + 1
                });

                await this.addTask({
                    ...task,
                    retryCount: task.retryCount + 1
                });
            } else {
                elizaLogger.info("Max retries reached", {
                    url: task.url,
                    retryCount: task.retryCount,
                    maxRetries: task.maxRetries
                });
            }
        }
    }

    private async saveCrawlRecord(record: CrawlRecord): Promise<void> {
        await this.runtime.ragKnowledgeManager.createKnowledge({
          id: stringToUuid(`crawl-record-${record.normalizedUrl}`),
          agentId: this.runtime.agentId,
          content: {
            text: JSON.stringify(record),
            metadata: {
              type: 'crawl_record',
              source: record.source,
              url: record.url,
              normalizedUrl: record.normalizedUrl,
              success: record.success,
              error: record.error
            }
          }
        });
    }

    private async extractRelevantContent(url: string, html: string): Promise<string> {
        const state = await this.runtime.composeState({
            agentId: this.runtime.agentId,
            content: {
                text: `Extract the most relevant content from ${url}`,
                agentId: this.runtime.agentId,
            },
            userId: stringToUuid('system'),
            roomId: stringToUuid('crawler-internal')
        }, {
            htmlContent: html,
        });

        const context = composeContext({
            state,
            template: extractContentTemplate,
        });

        const result = await generateText({
            runtime: this.runtime,
            context,
            modelClass: ModelClass.LARGE,
        });

        return result;
    }

    private async firecrawlUrl(task: CrawlTask): Promise<FirecrawlResult[]> {
        elizaLogger.info("Starting Firecrawl request", {
            url: task.url,
            limit: task.limit || this.config.CRAWL_MAX_PAGES,
            maxDepth: 2
        });

        const response = await this.firecrawl.crawlUrl(task.url, {
            limit: task.limit || this.config.CRAWL_MAX_PAGES,
            maxDepth: 2,
            scrapeOptions: {
                formats: ['html']  // We'll handle markdown conversion ourselves
            }
        });

        elizaLogger.info("Firecrawl response", {
            url: task.url,
            response: response
        });

        if (!response.success) {
            throw new Error(`Failed to crawl: ${task.url}`);
        }

        // Process each crawled document
        const processedResults = await Promise.all(response.data.map(async doc => {
            // Extract relevant content using LLM
            const relevantContent = await this.extractRelevantContent(doc.metadata.url, doc.html || '');

            return {
                url: doc.metadata.url || task.url,
                markdown: relevantContent,  // Use the LLM-extracted content
                crawlTimestamp: Date.now()
            };
        }));

        return processedResults;
    }

    private async saveToRagKnowledge(results: FirecrawlResult[], task: CrawlTask): Promise<void> {
        for (const result of results) {
            elizaLogger.info("Saving to RAG knowledge", {
                result,
            });
            await this.runtime.ragKnowledgeManager.createKnowledge({
                id: stringToUuid(`webpage-content-${result.url}`),
                agentId: this.runtime.agentId,
                content: {
                    text: result.markdown,  // Already contains the relevant content
                    metadata: {
                        type: 'webpage',
                        source: task.source,
                        url: result.url,
                        isShared: true,
                        crawlTimestamp: result.crawlTimestamp
                    },
                },
            });
        }
    }

    private determineSource(memory: Memory): CrawlTask['source'] {
      const metadata = memory.content?.metadata as MemoryMetadata | undefined;
      if (metadata?.source === 'twitter') {
        return 'twitter';
      }
      if (metadata?.source === 'external_db') {
        return 'external_db';
      }
      return 'direct_message';
    }
}