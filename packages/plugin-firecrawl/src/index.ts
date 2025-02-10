import { Plugin } from '@elizaos/core';
import { crawlAction } from './actions';
import { CrawlerService } from './services/crawler';

export const firecrawlPlugin: Plugin = {
    name: 'firecrawl',
    description: 'Plugin for crawling and storing web content inside RAG knowledge base',
    actions: [crawlAction],
    services: [new CrawlerService()],
}