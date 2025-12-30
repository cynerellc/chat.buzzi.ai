/**
 * Generate Quotation Tool
 *
 * This tool generates formal quotations based on customer requirements.
 * It uses pricing information to create accurate quotes with line items.
 *
 * Package Variables Used:
 * - COMPANY_NAME: Company name for quotation header
 * - SALES_EMAIL: Contact email for quotation inquiries
 * - CALENDAR_LINK: Link for scheduling follow-up meetings
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { AgentContext } from "@/lib/ai/types";

export const generateQuotationTool = tool(
  async (
    {
      customerName,
      customerEmail,
      customerCompany,
      items,
      currency = "USD",
      validityDays = 30,
      discountPercent = 0,
      taxPercent = 0,
      paymentTerms,
      notes,
    },
    { configurable }
  ) => {
    // Access package variables from context
    const context = configurable?.agentContext as AgentContext | undefined;
    const companyName = context?.variables.get("COMPANY_NAME") || "Our Company";
    const salesEmail = context?.variables.get("SALES_EMAIL");
    const calendarLink = context?.variables.get("CALENDAR_LINK");
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      return `Error: Invalid email address: ${customerEmail}`;
    }

    // Validate items
    if (!items || items.length === 0) {
      return "Error: At least one quotation item is required";
    }

    // Generate quotation number
    const quotationNumber = `QT-${Date.now().toString(36).toUpperCase()}`;
    const quotationDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + validityDays);

    // Calculate totals
    let subtotal = 0;
    const lineItems = items.map((item: { product: string; description?: string; quantity: number; unitPrice: number; discount?: number }, index: number) => {
      const lineDiscount = item.discount || 0;
      const lineTotal = item.quantity * item.unitPrice * (1 - lineDiscount / 100);
      subtotal += lineTotal;

      return {
        lineNumber: index + 1,
        product: item.product,
        description: item.description || "",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: lineDiscount,
        lineTotal: Math.round(lineTotal * 100) / 100,
      };
    });

    // Apply overall discount
    const discountAmount = subtotal * (discountPercent / 100);
    const afterDiscount = subtotal - discountAmount;

    // Apply tax
    const taxAmount = afterDiscount * (taxPercent / 100);
    const grandTotal = afterDiscount + taxAmount;

    // Format currency for display
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(amount);
    };

    // Build quotation summary
    let quotationSummary = `Quotation ${quotationNumber} generated successfully!\n\n`;
    quotationSummary += `**From: ${companyName}**\n\n`;
    quotationSummary += `**Customer Information**\n`;
    quotationSummary += `- Name: ${customerName}\n`;
    quotationSummary += `- Email: ${customerEmail}\n`;
    if (customerCompany) {
      quotationSummary += `- Company: ${customerCompany}\n`;
    }
    quotationSummary += `\n**Quotation Details**\n`;
    quotationSummary += `- Quotation #: ${quotationNumber}\n`;
    quotationSummary += `- Date: ${quotationDate.toLocaleDateString()}\n`;
    quotationSummary += `- Valid Until: ${expiryDate.toLocaleDateString()}\n`;
    quotationSummary += `\n**Line Items**\n`;

    lineItems.forEach((item) => {
      quotationSummary += `${item.lineNumber}. ${item.product}\n`;
      quotationSummary += `   Qty: ${item.quantity} × ${formatCurrency(item.unitPrice)}`;
      if (item.discount > 0) {
        quotationSummary += ` (${item.discount}% off)`;
      }
      quotationSummary += ` = ${formatCurrency(item.lineTotal)}\n`;
    });

    quotationSummary += `\n**Totals**\n`;
    quotationSummary += `- Subtotal: ${formatCurrency(Math.round(subtotal * 100) / 100)}\n`;
    if (discountPercent > 0) {
      quotationSummary += `- Discount (${discountPercent}%): -${formatCurrency(Math.round(discountAmount * 100) / 100)}\n`;
    }
    if (taxPercent > 0) {
      quotationSummary += `- Tax (${taxPercent}%): +${formatCurrency(Math.round(taxAmount * 100) / 100)}\n`;
    }
    quotationSummary += `- **Grand Total: ${formatCurrency(Math.round(grandTotal * 100) / 100)}**\n`;
    quotationSummary += `\n**Terms**\n`;
    quotationSummary += `- Payment: ${paymentTerms || "Due upon receipt"}\n`;
    if (notes) {
      quotationSummary += `- Notes: ${notes}\n`;
    }

    // Add contact information
    quotationSummary += `\n**Contact**\n`;
    if (salesEmail) {
      quotationSummary += `- Email: ${salesEmail}\n`;
    }
    if (calendarLink) {
      quotationSummary += `- Schedule a call: ${calendarLink}\n`;
    }

    console.log("[GenerateQuotation] Quotation generated:", quotationNumber);

    return quotationSummary;
  },
  {
    name: "generate_quotation",
    description:
      "Generate a formal quotation for a customer based on their requirements. " +
      "Use this when a customer requests pricing, a quote, or a proposal for products/services. " +
      "Include all relevant line items with quantities and pricing.",
    schema: z.object({
      customerName: z.string().describe("Customer's name for the quotation header"),
      customerEmail: z.string().describe("Customer's email address"),
      customerCompany: z.string().optional().describe("Customer's company name"),
      items: z
        .array(
          z.object({
            product: z.string().describe("Product or service name"),
            description: z.string().optional().describe("Item description"),
            quantity: z.number().describe("Quantity"),
            unitPrice: z.number().describe("Price per unit"),
            discount: z.number().optional().describe("Line item discount percentage"),
          })
        )
        .describe("Array of quotation line items"),
      currency: z
        .string()
        .optional()
        .describe("Currency code (e.g., 'USD', 'EUR', 'GBP'). Defaults to 'USD'"),
      validityDays: z
        .number()
        .optional()
        .describe("Number of days the quotation is valid. Defaults to 30"),
      discountPercent: z
        .number()
        .optional()
        .describe("Overall discount percentage to apply (0-100)"),
      taxPercent: z
        .number()
        .optional()
        .describe("Tax percentage to apply (0-100). Defaults to 0"),
      paymentTerms: z
        .string()
        .optional()
        .describe("Payment terms (e.g., 'Net 30', '50% upfront', 'Upon delivery')"),
      notes: z
        .string()
        .optional()
        .describe("Additional terms, conditions, or notes to include"),
    }),
  }
);
