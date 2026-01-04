import { tool } from "@langchain/core/tools";
import { z } from "zod";

const orderLookupToolBase = tool(
  async ({ orderId, customerEmail }) => {
    // TODO: Implement actual order management system integration
    if (orderId) {
      return `Order ${orderId}:\n- Status: Shipped\n- Items: 2 items\n- Total: $149.98\n- Tracking: TRACK123456\n- Estimated Delivery: 3-5 business days`;
    }
    if (customerEmail) {
      return `Recent orders for ${customerEmail}:\n1. Order #ORD-001 - $99.99 - Delivered\n2. Order #ORD-002 - $49.99 - Processing`;
    }
    return "Please provide an order ID or customer email to look up orders.";
  },
  {
    name: "order_lookup",
    description:
      "Look up order information by order ID or customer email. Use this to check order status, tracking information, and order history.",
    schema: z.object({
      orderId: z.string().optional().describe("The order ID to look up"),
      customerEmail: z
        .string()
        .optional()
        .describe("Customer email to find their orders"),
    }),
  }
);

export const orderLookupTool = Object.assign(orderLookupToolBase, {
  toolExecutingMessage: "Looking up order details...",
  toolCompletedMessage: "Order information found",
});
