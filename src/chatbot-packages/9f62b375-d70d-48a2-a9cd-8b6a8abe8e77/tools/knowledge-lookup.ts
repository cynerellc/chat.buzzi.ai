/**
 * Knowledge Lookup Tool
 *
 * This tool searches the knowledge base to find relevant information
 * for answering customer questions.
 *
 * Package Variables Used:
 * - COMPANY_NAME: Company name for context in responses
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { AgentContext } from "@/lib/ai/types";

export const knowledgeLookupTool = tool(
  async (
    {
      query,
      category,
      maxResults = 5,
    },
    { configurable }
  ) => {
    // Access package variables from context
    const context = configurable?.agentContext as AgentContext | undefined;
    const companyName = context?.variables.get("COMPANY_NAME") || "Our Company";

    // Validate query
    if (!query || query.trim().length < 3) {
      return "Error: Search query must be at least 3 characters long";
    }

    console.log(`[KnowledgeLookup] Searching for: "${query}"${category ? ` in category: ${category}` : ""}`);

    // In production, this would call the RAG service
    // For now, return a placeholder response
    const searchResults = {
      query: query.trim(),
      category: category || "all",
      resultsCount: 0,
      results: [] as Array<{
        title: string;
        content: string;
        relevanceScore: number;
        source: string;
      }>,
    };

    // Simulate no results found (actual implementation would use RAG service)
    if (searchResults.results.length === 0) {
      return `No knowledge base articles found for "${query}" at ${companyName}. ` +
        `I'll do my best to help based on my general knowledge, or I can connect you with a human agent for more specific assistance.`;
    }

    // Format results
    let response = `Found ${searchResults.resultsCount} relevant articles from ${companyName}'s knowledge base:\n\n`;

    searchResults.results.slice(0, maxResults).forEach((result, index) => {
      response += `**${index + 1}. ${result.title}**\n`;
      response += `${result.content}\n`;
      response += `_Source: ${result.source} (Relevance: ${Math.round(result.relevanceScore * 100)}%)_\n\n`;
    });

    return response;
  },
  {
    name: "knowledge_lookup",
    description:
      "Search the knowledge base to find relevant information for answering customer questions. " +
      "Use this tool when customers ask about products, services, policies, or procedures. " +
      "The knowledge base contains articles, FAQs, and documentation.",
    schema: z.object({
      query: z.string().describe("The search query - what the customer is asking about"),
      category: z
        .string()
        .optional()
        .describe("Optional category to filter results (e.g., 'products', 'billing', 'returns')"),
      maxResults: z
        .number()
        .optional()
        .describe("Maximum number of results to return. Defaults to 5"),
    }),
  }
);
