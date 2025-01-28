import { Plugin } from "@elizaos/core";
import { dappradarFactsProvider } from "./providers/facts.ts";

export const dappradarPlugin: Plugin = {
    name: "dappradar",
    description: "DappRadar plugin that provides facts about the user",
    actions: [],
    evaluators: [],
    providers: [dappradarFactsProvider],
};
export default dappradarPlugin;
