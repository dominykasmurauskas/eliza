import {
    Action,
    generateText,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
} from "@elizaos/core";

export const currentNewsAction: Action = {
    name: "CURRENT_NEWS",
    similes: ["GET_NEWS", "NEWS", "FETCH_NEWS", "NEWS_UPDATE"],
    description: "Get the current news for a search term if asked by the user",
    validate: async (_runtime: IAgentRuntime, _message: Memory): Promise<boolean> => {
        return true;
    },
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        _state: State,
        _options: { [key: string]: unknown },
        _callback: HandlerCallback
    ): Promise<boolean> => {
        async function getCurrentNews(searchTerm: string) {
            const response = await fetch(
                `https://newsapi.org/v2/everything?q=${searchTerm}&apiKey=${process.env.NEWS_API_KEY}`
            );
            const data = await response.json();

            return data.articles
                .slice(0, 5)
                .map(
                    (article) =>
                        `${article.title}\n${article.description}\n${article.url}\n${article.content.slice(0, 100)}`
                )
                .join("\n\n");
        }

        const context = `Extract the search term from the user's message. The message is:
        ${_message.content.text}

        Only respond with the search term, do not include any other text.`;

        const searchTerm = await generateText({
            runtime: _runtime,
            context,
            modelClass: ModelClass.SMALL,
            stop: ["\n"],
        });

        const currentNews = await getCurrentNews(searchTerm);
        const responseText =
            "The current news for the search term " +
            searchTerm +
            " is " +
            currentNews;


        const newMemory: Memory = {
            userId: _message.userId,
            agentId: _message.agentId,
            roomId: _message.roomId,
            content: {
                text: responseText,
                embedding: null,
            },
        };

        await _runtime.documentsManager.createMemory(newMemory);
        _callback(newMemory.content);

        return true;
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "What's the latest news about ai16z?" }
            },
            {
                user: "{{user2}}",
                content: {text: "", action: "CURRENT_NEWS"}
            },
        ],

        [
            {
                user: "{{user1}}",
                content: { text: "Can you show me current news about ai16z" }
            },
            {
                user: "{{user2}}",
                content: {text: "", action: "CURRENT_NEWS"}
            },
        ],

        [
            {
                user: "{{user1}}",
                content: { text: "get me the latest news about ai16z" }
            },
            {
                user: "{{user2}}",
                content: {text: "", action: "CURRENT_NEWS"}
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "what are the current news stories about ai16z?" }
            },
            {
                user: "{{user2}}",
                content: {text: "", action: "CURRENT_NEWS"}
            },
        ]
    ]
}  as Action;
