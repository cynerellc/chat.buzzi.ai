/**
 * Save Lead Info Tool
 *
 * This tool captures and stores lead information for sales follow-up.
 * It validates contact information and stores it for CRM integration.
 *
 * Package Variables Used:
 * - COMPANY_NAME: Company name for personalized responses
 * - SALES_EMAIL: Email for qualified leads to contact
 * - CRM_API_KEY (secured): API key for CRM integration
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { AgentContext } from "@/lib/ai/types";

export const saveLeadInfoTool = tool(
  async (
    {
      name,
      email,
      phone,
      company,
      jobTitle,
      budget,
      timeline,
      requirements,
      interestedProducts,
      leadScore,
      notes,
    },
    { configurable }
  ) => {
    // Access package variables from context
    const context = configurable?.agentContext as AgentContext | undefined;
    const companyName = context?.variables.get("COMPANY_NAME") || "Our Company";
    const salesEmail = context?.variables.get("SALES_EMAIL");
    const crmApiKey = context?.securedVariables.get("CRM_API_KEY");

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return `Error: Invalid email address format: ${email}`;
    }

    // Validate name
    if (name.trim().length < 2) {
      return "Error: Customer name must be at least 2 characters";
    }

    // Build lead data object
    const leadData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || null,
      company: company?.trim() || null,
      jobTitle: jobTitle?.trim() || null,
      budget: budget?.trim() || null,
      timeline: timeline?.trim() || null,
      requirements: requirements.trim(),
      interestedProducts: interestedProducts
        ? interestedProducts.split(",").map((p: string) => p.trim())
        : [],
      leadScore: leadScore || "warm",
      notes: notes?.trim() || null,
      capturedAt: new Date().toISOString(),
      source: companyName,
    };

    // If CRM API key is configured, sync to CRM
    if (crmApiKey) {
      console.log("[SaveLeadInfo] CRM API key configured - would sync to CRM");
      // In production: await syncToCRM(leadData, crmApiKey);
    }

    console.log("[SaveLeadInfo] Lead captured:", JSON.stringify(leadData, null, 2));

    const leadId = `lead_${Date.now()}`;

    let response = `Lead information saved successfully!\n\n` +
      `- Lead ID: ${leadId}\n` +
      `- Name: ${leadData.name}\n` +
      `- Email: ${leadData.email}\n` +
      `- Company: ${leadData.company || "Not provided"}\n` +
      `- Lead Score: ${leadData.leadScore}\n` +
      `- Captured: ${leadData.capturedAt}\n\n` +
      `The ${companyName} sales team will follow up with ${leadData.name} shortly.`;

    if (salesEmail) {
      response += `\n\nFor immediate assistance, ${leadData.name} can also reach our sales team at ${salesEmail}.`;
    }

    return response;
  },
  {
    name: "save_lead_info",
    description:
      "Save lead information collected during the conversation. Use this when you have gathered " +
      "contact details and requirements from a potential customer. This information will be used " +
      "for follow-up by the sales team.",
    schema: z.object({
      name: z.string().describe("Customer's full name"),
      email: z.string().describe("Customer's email address"),
      phone: z
        .string()
        .optional()
        .describe("Customer's phone number (with country code if international)"),
      company: z.string().optional().describe("Company or organization name"),
      jobTitle: z.string().optional().describe("Customer's job title or role"),
      budget: z
        .string()
        .optional()
        .describe("Estimated budget range (e.g., '$1,000-$5,000', 'Enterprise level')"),
      timeline: z
        .string()
        .optional()
        .describe("Purchase timeline (e.g., 'Immediately', 'Within 30 days', 'Q2 2025')"),
      requirements: z.string().describe("Summary of customer's requirements and needs"),
      interestedProducts: z
        .string()
        .optional()
        .describe("Products or services the customer is interested in (comma-separated)"),
      leadScore: z
        .enum(["hot", "warm", "cold"])
        .optional()
        .describe("Lead qualification score"),
      notes: z.string().optional().describe("Additional notes from the conversation"),
    }),
  }
);
