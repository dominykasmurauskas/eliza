import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";

const randomEmotionProvider: Provider = {
    get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
        const emotions = {
            happy: _runtime.character.name + " is feeling quite cheerful and optimistic right now",
            sad: _runtime.character.name + " is experiencing a sense of melancholy at the moment",
            excited: _runtime.character.name + " is bursting with enthusiasm and energy",
            angry: _runtime.character.name + " is feeling rather frustrated and irritated",
            calm: _runtime.character.name + " is in a peaceful and tranquil state of mind",
            anxious: _runtime.character.name + " is feeling somewhat nervous and uneasy",
            proud: _runtime.character.name + " is experiencing a strong sense of accomplishment",
            confused: _runtime.character.name + " is having trouble making sense of things right now",
            grateful: _runtime.character.name + " is feeling very thankful and appreciative",
            tired: _runtime.character.name + " is feeling quite exhausted and drained"
        };

        const emotionKeys = Object.keys(emotions);
        const randomKey = emotionKeys[Math.floor(Math.random() * emotionKeys.length)];

        return emotions[randomKey];

    },
};
export { randomEmotionProvider };
