import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const ticketCreateTool = tool(
  async ({ title, description, priority, category }) => {
    // TODO: Implement actual ticketing system integration
    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`;
    return `Support ticket created successfully!\n\n- Ticket ID: ${ticketId}\n- Title: ${title}\n- Priority: ${priority}\n- Category: ${category}\n\nOur technical team will review your issue and respond within 24 hours.`;
  },
  {
    name: "ticket_create",
    description:
      "Create a support ticket for technical issues that require follow-up. Use this when the issue cannot be resolved immediately.",
    schema: z.object({
      title: z.string().describe("Brief title describing the issue"),
      description: z.string().describe("Detailed description of the problem"),
      priority: z
        .enum(["low", "medium", "high", "critical"])
        .describe("Priority level of the issue"),
      category: z
        .enum(["bug", "feature-request", "integration", "performance", "other"])
        .describe("Category of the technical issue"),
    }),
  }
);
