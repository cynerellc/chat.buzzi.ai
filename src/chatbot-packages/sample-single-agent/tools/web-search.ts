import { tool } from "@langchain/core/tools";
import { z } from "zod";

const webSearchToolBase = tool(
  async ({ query }) => {
    // TODO: Implement actual web search integration
    // This could use Google Search API, Bing API, or custom search
    return `Search results for: ${query}\n\n1. Result 1: Sample search result for "${query}"\n2. Result 2: Another relevant result`;
  },
  {
    name: "web_search",
    description: "Search the web for current information about a topic",
    schema: z.object({
      query: z.string().describe("The search query to look up"),
    }),
  }
);

// Add custom notification messages for UI display
export const webSearchTool = Object.assign(webSearchToolBase, {
  toolExecutingMessage: "Searching the web...",
  toolCompletedMessage: "Search complete",
});
