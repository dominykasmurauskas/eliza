import { Memory } from '@elizaos/core';

export interface CrawlTask {
  url: string;
  source: 'twitter' | 'direct_message' | 'external_db';
  retryCount: number;
  maxRetries: number;
  timestamp: number;
  sourceMemory?: Memory;
  formats?: ('markdown' | 'html')[];
  limit?: number;
}

export interface FirecrawlResult {
  url: string;
  markdown?: string;
  html?: string;
  crawlTimestamp: number;
}

export interface CrawlError {
  url: string;
  error: string;
  timestamp: number;
  retryCount: number;
}

export interface CrawlOptions {
  formats?: ('markdown' | 'html')[];
  limit?: number;
  excludePaths?: string[];
  forceCrawl?: boolean; // Force crawling even if URL exists in DB
}

export interface CrawlRecord {
  url: string;
  normalizedUrl: string;
  lastCrawled: number;
  source: CrawlTask['source'];
  success: boolean;
  error?: string;
}


export interface MemoryMetadata {
    source?: string;
    [key: string]: any;
  }
