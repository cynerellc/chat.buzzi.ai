import { tool } from "@langchain/core/tools";
import { z } from "zod";

const knowledgeLookupToolBase = tool(
  async ({ query, category }) => {
    // TODO: This will be replaced by the platform's RAG tool injection
    // The AdkExecutor provides RAG capabilities automatically
    return `Knowledge base results for "${query}" in category "${category || "all"}":\n\n- Document 1: Relevant information found\n- Document 2: Additional context`;
  },
  {
    name: "knowledge_lookup",
    description:
      "Search the company knowledge base for relevant information. Use this before answering questions about company policies, products, or procedures.",
    schema: z.object({
      query: z.string().describe("The query to search in the knowledge base"),
      category: z
        .string()
        .optional()
        .describe("Optional category to filter the search"),
    }),
  }
);

// Add custom notification messages for UI display
export const knowledgeLookupTool = Object.assign(knowledgeLookupToolBase, {
  toolExecutingMessage: "Searching knowledge base...",
  toolCompletedMessage: "Found relevant information",
});
