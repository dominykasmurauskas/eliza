import { Client, elizaLogger, IAgentRuntime, Plugin } from "@elizaos/core";
import pg from "pg";
type Pool = pg.Pool;
import { validateExternalDbImporterConfig, ExternalDbImporterConfig } from "./environment.ts";
import { ExternalDbImporter } from "./importer.ts";

class ExternalDbImporterManager {
    pool: Pool;
    importer: ExternalDbImporter;

    constructor(runtime: IAgentRuntime, config: ExternalDbImporterConfig) {
        this.pool = new pg.Pool({
            connectionString: config.EXTERNAL_DB_URL,
        });
        this.importer = new ExternalDbImporter(
            this.pool,
            runtime,
            config.EXTERNAL_DB_SYNC_INTERVAL
        );
    }
}

const ExternalDbImporterClientInterface: Client = {
    async start(runtime: IAgentRuntime) {
        const externalDbImporterConfig = await validateExternalDbImporterConfig(runtime);

        if (!externalDbImporterConfig.EXTERNAL_DB_URL) {
            elizaLogger.warn("No database URL specified for External DB Importer client");
            return;
        }

        elizaLogger.log("External DB Importer client started");

        const manager = new ExternalDbImporterManager(runtime, externalDbImporterConfig);

        // Initialize database connection
        await manager.pool.connect();

        // Start the syncing process
        await manager.importer.start();

        return manager;
    },

    async stop(runtime: IAgentRuntime) {
        elizaLogger.warn("External DB Importer client does not support stopping yet");
    },
};

export const externalDbImporterPlugin: Plugin = {
    name: "external-db-importer",
    description: "External DB Importer client for syncing data to RAG",
    clients: [ExternalDbImporterClientInterface],
};
