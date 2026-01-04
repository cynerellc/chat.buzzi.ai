import { tool } from "@langchain/core/tools";
import { z } from "zod";

const knowledgeBaseToolBase = tool(
  async ({ query, docType }) => {
    // TODO: This will be replaced by the platform's RAG tool injection
    const docTypeLabel = docType || "all documentation";
    return `Technical documentation results for "${query}" in ${docTypeLabel}:\n\n1. Getting Started Guide\n   - Step-by-step setup instructions\n\n2. Troubleshooting FAQ\n   - Common issues and solutions\n\n3. API Reference\n   - Endpoint documentation and examples`;
  },
  {
    name: "knowledge_base",
    description:
      "Search the technical knowledge base for documentation, guides, and troubleshooting information.",
    schema: z.object({
      query: z
        .string()
        .describe("The technical query to search for"),
      docType: z
        .enum(["guide", "api", "faq", "troubleshooting"])
        .optional()
        .describe("Type of documentation to search"),
    }),
  }
);

export const knowledgeBaseTool = Object.assign(knowledgeBaseToolBase, {
  toolExecutingMessage: "Searching knowledge base...",
  toolCompletedMessage: "Documentation found",
});
