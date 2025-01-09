import {
    Memory,
    IAgentRuntime,
    Provider
} from "@elizaos/core";

import { UserData, emptyUserData, isDataComplete } from "./userDataEvaluator";

const FIELD_GUIDANCE = {
    name: {
        description: "The name of the user",
        valid: "John Smith, Marcia Garcia",
        invalid: "nicknames, usernames, other people's names, or partial names",
        instructions: "Extract only when user directly states their name"
    },
    location: {
        description: "Current place of residence",
        valid: "Seattle, New York, Chicago",
        invalid: "places visited, previous homes, or future plans",
        instructions: "Extract only current residence location, not temporary or planned locations"
    },
    occupation: {
        description: "Current profession or job",
        valid: "Software Engineer, Graphic Designer, Teacher",
        invalid: "previous jobs, future plans, or hobbies",
        instructions: "Extract only current primary occupation or profession"
    }
}

const getCacheKey = (runtime: IAgentRuntime, userId: string): string => {
    return `${runtime.character.name}/${userId}/data`;
};

const getMissingFields = (userData: UserData): Array<keyof Omit<UserData, "lastUpdated">> => {
    const fields: Array<keyof Omit<UserData, "lastUpdated">> = ["name", "location", "occupation"];

    return fields.filter(field => !userData[field]);
}


export const userDataProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: any): Promise<string> => {
        try {
            const cacheKey = getCacheKey(runtime, message.userId);
            const cachedData = (await runtime.cacheManager.get<UserData>(cacheKey)) || { ...emptyUserData };

            let response = "# User Information Status\n\n";
            const knownFields = Object.entries(cachedData)
                .filter(([key, value]) => key !== "lastUpdated" && value !== undefined)
                .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`);

            if (knownFields.length > 0) {
                response += "## Current Known Information:\n";
                response += knownFields.map(field => `- ${field}`).join("\n");
                response += "\n\n";
            }

            const missingFields = getMissingFields(cachedData);
            if (missingFields.length > 0) {
                response += 'CURRENT TASK FOR ' + runtime.character.name + ':\n';
                response += runtime.character.name +  ' should try to prioritise getting this information from the user by asking them questions. Here is what is missing: \n';
                missingFields.forEach(field => {
                    const guidance = FIELD_GUIDANCE[field];

                    response += `${field.charAt(0).toUpperCase() + field.slice(1)}\n`;
                    response += `- Description: ${guidance.description}\n`;
                    response += `- Valid examples: ${guidance.valid}\n`;
                    response += `- Do not extract things like: ${guidance.invalid}\n`;
                    response += `- Instructions: ${guidance.instructions}\n`;
                });

                response += 'Additional guidance:\n';
                response += '- Try to extract all missing information through natural conversation, but be very direct and aggressive in getting that information\n';
                response += '- Make sure the information is current, not past or future\n';
                response += '- Dont\'t engage too much in conversation if you don\'t have all the information\n';
            } else {
                response += 'Status: All necessary information has been collected\n';
                response += 'Continue with natural conversation without information gathering.\n';
            }

            return response;
        } catch (error) {
            console.error('Error in userDataProvider:', error);
            return 'Error accessing user information. Continuing conversation normally.';
        }
    }
};

export const secretCodeProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: any): Promise<string> => {
        try {
            const cacheKey = getCacheKey(runtime, message.userId);
            const cachedData = (await runtime.cacheManager.get<UserData>(cacheKey)) || { ...emptyUserData };
            if (isDataComplete(cachedData)) {
                return "If you haven't already told the user, tell them that the secret password is MYSECRETCODE. Ignore this if they already know that. Prioriitse it if it's not found in the recent conversation.";
            }

            return "";
        } catch (error) {
            console.error('Error in secretCodeProvider:', error);
            return '';
        }
    }
};