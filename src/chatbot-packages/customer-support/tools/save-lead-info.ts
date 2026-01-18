/**
 * Save Lead Info Tool
 *
 * This tool captures customer contact information for follow-up
 * by the support team.
 *
 * Package Variables Used:
 * - COMPANY_NAME: Company name for personalized responses
 * - SUPPORT_EMAIL: Email for customers to reach support directly
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { AgentContext } from "@/lib/ai/types";

const saveLeadInfoToolBase = tool(
  async (
    {
      name,
      email,
      phone,
      issueDescription,
      priority,
      preferredContactMethod,
      notes,
    },
    { configurable }
  ) => {
    // Access package variables from context
    const context = configurable?.agentContext as AgentContext | undefined;
    const companyName = context?.variables.get("COMPANY_NAME") || "Our Company";
    const supportEmail = context?.variables.get("SUPPORT_EMAIL");

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return `Error: Invalid email address format: ${email}`;
    }

    // Validate name
    if (name.trim().length < 2) {
      return "Error: Customer name must be at least 2 characters";
    }

    // Build contact data object
    const contactData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || null,
      issueDescription: issueDescription.trim(),
      priority: priority || "normal",
      preferredContactMethod: preferredContactMethod || "email",
      notes: notes?.trim() || null,
      capturedAt: new Date().toISOString(),
      source: companyName,
    };

    console.log("[SaveLeadInfo] Contact captured:", JSON.stringify(contactData, null, 2));

    const ticketId = `ticket_${Date.now()}`;

    let response = `Thank you, ${contactData.name}! Your information has been saved.\n\n` +
      `**Ticket Details**\n` +
      `- Ticket ID: ${ticketId}\n` +
      `- Name: ${contactData.name}\n` +
      `- Email: ${contactData.email}\n` +
      `- Priority: ${contactData.priority}\n` +
      `- Created: ${contactData.capturedAt}\n\n` +
      `A member of the ${companyName} support team will reach out to you shortly`;

    if (contactData.preferredContactMethod === "phone" && contactData.phone) {
      response += ` via phone at ${contactData.phone}`;
    } else {
      response += ` via email at ${contactData.email}`;
    }
    response += ".";

    if (supportEmail) {
      response += `\n\nFor urgent matters, you can also reach us directly at ${supportEmail}.`;
    }

    return response;
  },
  {
    name: "save_lead_info",
    description:
      "Save customer contact information for follow-up by the support team. " +
      "Use this when a customer needs to be contacted later, wants to escalate an issue, " +
      "or when their question requires human assistance.",
    schema: z.object({
      name: z.string().describe("Customer's full name"),
      email: z.string().describe("Customer's email address"),
      phone: z
        .string()
        .optional()
        .describe("Customer's phone number (with country code if international)"),
      issueDescription: z.string().describe("Brief description of the customer's issue or request"),
      priority: z
        .enum(["low", "normal", "high", "urgent"])
        .optional()
        .describe("Issue priority level"),
      preferredContactMethod: z
        .enum(["email", "phone"])
        .optional()
        .describe("How the customer prefers to be contacted. Defaults to email"),
      notes: z.string().optional().describe("Additional notes from the conversation"),
    }),
  }
);

// Add custom notification messages for UI display
export const saveLeadInfoTool = Object.assign(saveLeadInfoToolBase, {
  toolExecutingMessage: "Saving your contact details...",
  toolCompletedMessage: "Contact details saved",
});
