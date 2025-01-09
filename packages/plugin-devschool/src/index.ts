import { Plugin } from "@elizaos/core";
import { helloWorldAction } from "./actions/helloworld.ts";
import { randomEmotionProvider } from "./providers/time.ts";
import { currentNewsAction } from "./actions/currentnews.ts";
export * as actions from "./actions";
export * as providers from "./providers";

export const devSchoolPlugin: Plugin = {
    name: "devschool",
    description: "Dev School example plugin",
    actions: [
        helloWorldAction,
        currentNewsAction,
    ],
    evaluators: [],
    providers: [randomEmotionProvider],
};

export default devSchoolPlugin;