/**
 * Tool Name Humanizer
 *
 * Converts internal tool names to human-readable descriptions
 * for display in the chat widget.
 */

// Predefined tool descriptions for common tools
const TOOL_DESCRIPTIONS: Record<string, string> = {
  // Knowledge base
  search_knowledge_base: "Searching knowledge base...",
  searchKnowledgeBase: "Searching knowledge base...",

  // Product related
  list_products: "Fetching products...",
  listProducts: "Fetching products...",
  get_product: "Getting product details...",
  getProduct: "Getting product details...",
  search_products: "Searching products...",
  searchProducts: "Searching products...",

  // Order related
  get_order_status: "Looking up order status...",
  getOrderStatus: "Looking up order status...",
  track_order: "Tracking your order...",
  trackOrder: "Tracking your order...",
  create_order: "Creating order...",
  createOrder: "Creating order...",

  // Customer related
  get_customer_info: "Retrieving customer information...",
  getCustomerInfo: "Retrieving customer information...",
  update_customer: "Updating customer details...",
  updateCustomer: "Updating customer details...",

  // General utilities
  check_weather: "Checking weather...",
  checkWeather: "Checking weather...",
  get_time: "Getting current time...",
  getTime: "Getting current time...",
  calculate: "Calculating...",
  search: "Searching...",

  // Support related
  create_ticket: "Creating support ticket...",
  createTicket: "Creating support ticket...",
  escalate: "Escalating to support...",
  transfer_to_agent: "Transferring...",
  transferToAgent: "Transferring...",

  // Payment related
  process_payment: "Processing payment...",
  processPayment: "Processing payment...",
  get_payment_status: "Checking payment status...",
  getPaymentStatus: "Checking payment status...",

  // Scheduling
  schedule_appointment: "Scheduling appointment...",
  scheduleAppointment: "Scheduling appointment...",
  check_availability: "Checking availability...",
  checkAvailability: "Checking availability...",
};

/**
 * Convert a tool name to a human-readable description
 *
 * @param toolName - The internal tool name (e.g., "search_knowledge_base")
 * @returns Human-readable description (e.g., "Searching knowledge base...")
 */
export function humanizeToolCall(toolName: string): string {
  // Check predefined mappings first
  if (TOOL_DESCRIPTIONS[toolName]) {
    return TOOL_DESCRIPTIONS[toolName];
  }

  // Fallback: convert snake_case/camelCase to readable text
  const readable = toolName
    // Insert space before capital letters (camelCase)
    .replace(/([A-Z])/g, " $1")
    // Replace underscores with spaces (snake_case)
    .replace(/_/g, " ")
    // Normalize multiple spaces
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();

  if (!readable) {
    return "Processing...";
  }

  // Capitalize first letter and add ellipsis
  return readable.charAt(0).toUpperCase() + readable.slice(1) + "...";
}

/**
 * Convert tool arguments to a human-readable summary
 *
 * @param toolName - The tool name
 * @param args - The tool arguments
 * @returns Optional human-readable summary of what the tool is doing
 */
export function summarizeToolAction(
  toolName: string,
  args?: Record<string, unknown>
): string | undefined {
  if (!args) return undefined;

  // Knowledge base search
  if (
    (toolName === "search_knowledge_base" ||
      toolName === "searchKnowledgeBase") &&
    args.query
  ) {
    return `Searching for "${args.query}"...`;
  }

  // Product search
  if (
    (toolName === "search_products" || toolName === "searchProducts") &&
    args.query
  ) {
    return `Finding products matching "${args.query}"...`;
  }

  // Order tracking
  if (
    (toolName === "get_order_status" ||
      toolName === "getOrderStatus" ||
      toolName === "track_order" ||
      toolName === "trackOrder") &&
    args.orderId
  ) {
    return `Tracking order ${args.orderId}...`;
  }

  return undefined;
}
