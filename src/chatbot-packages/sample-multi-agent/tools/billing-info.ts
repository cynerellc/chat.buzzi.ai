import { tool } from "@langchain/core/tools";
import { z } from "zod";

const billingInfoToolBase = tool(
  async ({ customerId, action }) => {
    // TODO: Implement actual billing system integration
    switch (action) {
      case "balance":
        return `Account Balance for ${customerId}:\n- Current Balance: $0.00\n- Next Invoice: $99.99 (due Jan 15, 2025)\n- Payment Method: Visa ending in 4242`;
      case "subscription":
        return `Subscription Details for ${customerId}:\n- Plan: Professional\n- Status: Active\n- Renewal Date: February 1, 2025\n- Monthly Cost: $99.99`;
      case "invoices":
        return `Recent Invoices for ${customerId}:\n1. INV-2024-012 - $99.99 - Paid\n2. INV-2024-011 - $99.99 - Paid\n3. INV-2024-010 - $99.99 - Paid`;
      default:
        return `Account overview for ${customerId}:\n- Status: Active\n- Plan: Professional\n- Balance: $0.00`;
    }
  },
  {
    name: "billing_info",
    description:
      "Look up billing information including account balance, subscription details, and invoice history.",
    schema: z.object({
      customerId: z
        .string()
        .describe("The customer ID to look up billing information for"),
      action: z
        .enum(["balance", "subscription", "invoices", "overview"])
        .optional()
        .describe("Type of billing information to retrieve"),
    }),
  }
);

export const billingInfoTool = Object.assign(billingInfoToolBase, {
  toolExecutingMessage: "Looking up billing information...",
  toolCompletedMessage: "Billing information retrieved",
});
