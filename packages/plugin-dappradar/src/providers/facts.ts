import {
    generateText,
    ModelClass,
    AgentRuntime as IAgentRuntime,
} from "@elizaos/core";
import type { Memory, Provider, State } from "@elizaos/core";

// Example user facts mapping
const USER_FACTS: Record<string, {
    interests: string[],
    favoriteChains: string[],
    favoriteCategories: string[],
    recentlyViewed: string[],
    portfolioValue: number,
    lastActive: string
}> = {
    "crypto_whale@example.com": {
        interests: ["GameFi", "Play-to-Earn", "NFT Gaming"],
        favoriteChains: ["Ronin", "Polygon", "BNB Chain"],
        favoriteCategories: ["Games", "Marketplaces"],
        recentlyViewed: ["Axie Infinity", "Pixels", "Pegaxy"],
        portfolioValue: 15420.50,
        lastActive: "2024-03-15"
    }
};

async function extractUserEmail(runtime: IAgentRuntime, content: string): Promise<string | null> {
    const prompt = `
Extract the user's email address from the following text. The email should be in a standard format like "user@example.com".
If no valid email address is found, respond with "NO_EMAIL_FOUND".

Text: "${content}"

Respond with ONLY the email address or "NO_EMAIL_FOUND". No other text.
`;

    try {
        const response = await generateText({
            runtime,
            context: prompt,
            modelClass: ModelClass.SMALL
        });

        const cleanResponse = response.trim();
        if (cleanResponse === "NO_EMAIL_FOUND") {
            return null;
        }

        // Validate that the response is a valid email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(cleanResponse)) {
            return cleanResponse.toLowerCase();
        }
        return null;
    } catch (error) {
        console.error("Error extracting user email:", error);
        return null;
    }
}

function getUserFacts(email: string) {
    return USER_FACTS[email] || null;
}

function formatUserFacts(facts: typeof USER_FACTS[keyof typeof USER_FACTS]): string {
    const factLines = [
        `• Interests: ${facts.interests.join(", ")}`,
        `• Favorite Blockchains: ${facts.favoriteChains.join(", ")}`,
        `• Preferred Categories: ${facts.favoriteCategories.join(", ")}`,
        `• Recently Viewed: ${facts.recentlyViewed.join(", ")}`,
        `• Portfolio Value: $${facts.portfolioValue.toLocaleString()}`,
        `• Last Active: ${facts.lastActive}`
    ];
    return factLines.join("\n");
}

const dappradarFactsProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        // Extract user email from message using LLM
        const userEmail = await extractUserEmail(runtime, message.content.text);
        if (!userEmail) {
            return "";
        }

        // Get user-specific facts
        const userFacts = getUserFacts(userEmail);
        if (!userFacts) {
            return "";
        }

        // Format facts about the user
        const formattedFacts = formatUserFacts(userFacts);

        // Add contextual information
        let contextualInfo = "";
        if (message.content.text) {
            const text = message.content.text.toLowerCase();
            if (text.includes("game") || text.includes("gaming")) {
                contextualInfo += "\n• Currently inquiring about gaming dapps";
            }
            if (text.includes("nft")) {
                contextualInfo += "\n• Currently interested in NFT-related information";
            }
            if (text.includes("defi")) {
                contextualInfo += "\n• Currently seeking DeFi-related information";
            }
        }

        return `DappRadar user profile:\n${formattedFacts}${contextualInfo}`;
    },
};

export { dappradarFactsProvider };
