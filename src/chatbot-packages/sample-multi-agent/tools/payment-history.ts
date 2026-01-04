import { tool } from "@langchain/core/tools";
import { z } from "zod";

const paymentHistoryToolBase = tool(
  async ({ customerId, startDate, endDate }) => {
    // TODO: Implement actual payment system integration
    const dateRange = startDate && endDate
      ? `from ${startDate} to ${endDate}`
      : "last 3 months";

    return `Payment History for ${customerId} (${dateRange}):\n
1. Dec 15, 2024 - $99.99 - Successful - Visa ****4242
2. Nov 15, 2024 - $99.99 - Successful - Visa ****4242
3. Oct 15, 2024 - $99.99 - Successful - Visa ****4242

Total Payments: $299.97
Payment Method on File: Visa ending in 4242`;
  },
  {
    name: "payment_history",
    description:
      "Retrieve payment transaction history for a customer account.",
    schema: z.object({
      customerId: z
        .string()
        .describe("The customer ID to look up payment history for"),
      startDate: z
        .string()
        .optional()
        .describe("Start date for the history range (YYYY-MM-DD)"),
      endDate: z
        .string()
        .optional()
        .describe("End date for the history range (YYYY-MM-DD)"),
    }),
  }
);

export const paymentHistoryTool = Object.assign(paymentHistoryToolBase, {
  toolExecutingMessage: "Retrieving payment history...",
  toolCompletedMessage: "Payment history retrieved",
});
