import { IAgentRuntime } from "@elizaos/core";

export interface ExternalDbImporterConfig {
    EXTERNAL_DB_URL: string;
    EXTERNAL_DB_SYNC_INTERVAL: number;
}

export async function validateExternalDbImporterConfig(runtime: IAgentRuntime): Promise<ExternalDbImporterConfig> {
    const config = {
        EXTERNAL_DB_URL: process.env.EXTERNAL_DB_URL,
        EXTERNAL_DB_SYNC_INTERVAL: parseInt(process.env.EXTERNAL_DB_SYNC_INTERVAL || '60000'), // 1 minute default
    };

    if (!config.EXTERNAL_DB_URL) {
        throw new Error("EXTERNAL_DB_URL is required");
    }

    return config;
}