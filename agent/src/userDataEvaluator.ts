import {
    Memory,
    IAgentRuntime,
    Evaluator,
    ModelClass,
    elizaLogger,
    generateObject
} from "@elizaos/core";
import { z } from "zod";

export interface UserData {
    name: string | undefined;
    location: string | undefined;
    occupation: string | undefined;
    lastUpdated: number | undefined;
}

export const emptyUserData = {
    name: undefined,
    location: undefined,
    occupation: undefined,
    lastUpdated: undefined
}

const getCacheKey = (runtime: IAgentRuntime, userId: string): string => {
    return `${runtime.character.name}/${userId}/data`;
};

const getMissingFields = (userData: UserData): Array<keyof Omit<UserData, "lastUpdated">> => {
    const fields: Array<keyof Omit<UserData, "lastUpdated">> = ["name", "location", "occupation"];

    return fields.filter(field => !userData[field]);
}

export const isDataComplete = (userData: UserData): boolean => {
    return getMissingFields(userData).length === 0;
};

// The Evaluator implementation
export const userDataEvaluator: Evaluator = {
    name: "GET_USER_DATA",
    similes: [
        "COLLECT_USER_INFO",
        "GATHER_USER_DATA",
        "UPDATE_USER_INFO",
        "EXTRACT_USER_DETAILS"
    ],
    description: "Extract user's name, location, and occupation from conversation when clearly stated.",
    alwaysRun: true,
    validate: async (runtime: IAgentRuntime, message: Memory, state?: any): Promise<boolean> => {
        try {
            const cacheKey = getCacheKey(runtime, message.userId);
            const cachedData = (await runtime.cacheManager.get<UserData>(cacheKey)) || { ...emptyUserData };

            return !isDataComplete(cachedData);
        } catch (error) {
            elizaLogger.error('Error in userDataEvaluator:', error);
            return false;
        }
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: any): Promise<void> => {
        try {
            const cacheKey = getCacheKey(runtime, message.userId);
            const cachedData = await runtime.cacheManager.get<UserData>(cacheKey) || { ...emptyUserData };

            const extractionTemplate = `
                Analyze the following message to extract personal information.
                Only extract information that is explicitly stated or clearly stated by the user about themselves.

                Conversation
                "${message.content.text}"

                Return a JSON object containing only the fields where information was cleary found:
                {
                    "name": "Extract full name of the user if stated",
                    "location": Extracted current residence if stated,
                    "occupation": "Extracted current occupation if stated"
                }

                Only include fields where information is explicitly stated and current.
                Omit fields if information is unclear, hypothetical, or about others.
            `;

            const extractedInfo = await generateObject({
                runtime,
                context: extractionTemplate,
                modelClass: ModelClass.SMALL,
                schema: z.object({
                    name: z.string().nullable().transform(val => val ?? undefined),
                    location: z.string().nullable().transform(val => val ?? undefined),
                    occupation: z.string().nullable().transform(val => val ?? undefined)
                }),
            });

            let dataUpdated = false;

            for (const field of ['name', 'location', 'occupation']) {
                if (extractedInfo.object[field] && cachedData[field] === undefined) {
                    dataUpdated = true;
                    cachedData[field] = extractedInfo.object[field];
                }
            }

            if (dataUpdated) {
                cachedData.lastUpdated = Date.now();
                await runtime.cacheManager.set(cacheKey, cachedData, {
                    expires: Date.now() + 1000 * 60 * 60 * 24 * 7 // 1 week
                });

                if (isDataComplete(cachedData)) {
                    elizaLogger.success('User data collection complete', cachedData);
                }
            }
        } catch (error) {
            elizaLogger.error('Error in userDataEvaluator handler:', error);
        }
    },

    examples: [
        {
            context: "Initial conversation with new user",
            messages: [
                {
                    user: "{{user1}}",
                    content: {
                        text: "Hi everyone! I'm Sarah, just moved to Seattle from NYC"
                    }
                }
            ],
            outcome: JSON.stringify({
                name: "Sarah",
                location: "Seattle",
                occupation: undefined
            })
        },
        {
            context: "Work discussion",
            messages: [
                {
                    user: "{{user1}}",
                    content: {
                        text: "I've been working as a software engineer at Amazon for about 3 years now"
                    }
                }
            ],
            outcome: JSON.stringify({
                name: undefined,
                location: undefined,
                occupation: "software engineer"
            })
        },
        {
            context: "Indirect information sharing",
            messages: [
                {
                    user: "{{user1}}",
                    content: {
                        text: "The weather here in Chicago is terrible, but at least I can work from home as a graphic designer"
                    }
                }
            ],
            outcome: JSON.stringify({
                name: undefined,
                location: "Chicago",
                occupation: "graphic designer"
            })
        },
        {
            // Negative example - no extractable information
            context: "General conversation without personal info",
            messages: [
                {
                    user: "{{user1}}",
                    content: {
                        text: "That's really interesting! I've never thought about it that way before."
                    }
                }
            ],
            outcome: `{}`
        },
        {
            // Negative example - ambiguous information
            context: "Ambiguous location reference",
            messages: [
                {
                    user: "{{user1}}",
                    content: {
                        text: "I love visiting New York, such a great city!"
                    }
                }
            ],
            outcome: `{}`
        },
        {
            // Negative example - past information
            context: "Historical information",
            messages: [
                {
                    user: "{{user1}}",
                    content: {
                        text: "Back when I used to be a teacher in Boston..."
                    }
                }
            ],
            outcome: `{}`
        }
    ]
};