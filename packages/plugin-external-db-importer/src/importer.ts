import { elizaLogger, IAgentRuntime, stringToUuid } from "@elizaos/core";
import pg from "pg";
type Pool = pg.Pool;

interface ExternalDbKnowledge {
    id: string;
    content: string;
    knowledge_type: string;
    topics: string[];
    sentiment: string;
    timestamp: Date;
}

export class ExternalDbImporter {
    private isProcessing: boolean = false;
    private isRunning: boolean = false;
    private lastProcessedTimestamp: Date | null = null;
    private syncInterval: NodeJS.Timeout | null = null;

    constructor(
        private pool: Pool,
        private runtime: IAgentRuntime,
        private interval: number
    ) {}

    async start() {
        if (this.isRunning) {
            elizaLogger.warn("External DB Importer is already running");
            return;
        }

        this.isRunning = true;

        // Initial sync
        setTimeout(() => {
            this.syncKnowledge().catch(error => {
                elizaLogger.error("Error during initial External DB Importer load:", error);
            });
        }, 0);

        // Start periodic sync
        this.syncInterval = setInterval(() => {
            this.syncKnowledge().catch(error => {
                elizaLogger.error("Error during External DB Importer sync:", error);
            });
        }, this.interval);
    }

    private async syncKnowledge() {
        if (this.isProcessing) {
            elizaLogger.info("External DB Importer sync already in progress, skipping");
            return;
        }

        this.isProcessing = true;

        try {
            const query = `
                SELECT id, content, knowledge_type, topics, sentiment, timestamp
                FROM discord_knowledge
                WHERE timestamp > $1
                ORDER BY timestamp ASC
                LIMIT 100
            `;

            const result = await this.pool.query(query, [this.lastProcessedTimestamp || new Date(0)]);

            for (const row of result.rows) {
                try {
                    await this.storeKnowledge(row);
                    this.lastProcessedTimestamp = row.timestamp;
                } catch (error) {
                    elizaLogger.error(`Failed to process knowledge row:`, { error, row });
                }
            }

            elizaLogger.info(`Synced ${result.rows.length} Discord knowledge items`);
        } catch (error) {
            elizaLogger.error("Error syncing Discord knowledge:", error);
        } finally {
            this.isProcessing = false;
        }
    }

    private formatKnowledgeForRag(knowledge: ExternalDbKnowledge): string {
        return `Knowledge collected from Pixels Discord server:
Type: ${knowledge.knowledge_type}
Topics: ${Array.isArray(knowledge.topics) ? knowledge.topics.join(', ') : knowledge.topics}
Sentiment: ${knowledge.sentiment}
Timestamp: ${knowledge.timestamp.toISOString()}
Content:
${knowledge.content}`;
    }

    private async storeKnowledge(knowledge: ExternalDbKnowledge) {
        const formattedContent = this.formatKnowledgeForRag(knowledge);
        const id = `external-db-${knowledge.id}`;

        try {
            await this.runtime.ragKnowledgeManager.createKnowledge({
                id: stringToUuid(id),
                agentId: this.runtime.agentId,
                content: {
                    text: formattedContent,
                    metadata: {
                        source: "external_db_knowledge",
                        type: "text",
                        createdAt: knowledge.timestamp.getTime(),
                        isShared: true
                    },
                },
            });
        } catch (error) {
            elizaLogger.error(`Failed to store External DB knowledge:`, { error, id });
            throw error;
        }
    }

    async stop() {
        this.isRunning = false;
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        elizaLogger.info("External DB Importer stopped");
    }
}
