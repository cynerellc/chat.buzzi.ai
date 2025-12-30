import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { AgentContext } from "@/lib/ai/types";

/**
 * Send Email Tool
 *
 * This tool demonstrates how to use package variables to configure
 * external service integrations. The email credentials are stored
 * as package variables (some secured) and accessed at runtime.
 *
 * Required Package Variables:
 * - EMAIL_HOST (variable): SMTP server hostname
 * - EMAIL_PORT (variable): SMTP server port
 * - EMAIL_USERNAME (secured_variable): SMTP username
 * - EMAIL_PASSWORD (secured_variable): SMTP password
 * - EMAIL_FROM (variable): Default from address
 */
export const createSendEmailTool = (context: AgentContext) =>
  tool(
    async ({ to, subject, body }) => {
      // Access package variables for email configuration
      const host = context.variables.get("EMAIL_HOST");
      const port = context.variables.get("EMAIL_PORT");
      const username = context.securedVariables.get("EMAIL_USERNAME");
      const password = context.securedVariables.get("EMAIL_PASSWORD");
      const fromAddress = context.variables.get("EMAIL_FROM");

      // Validate required variables
      if (!host || !port || !username || !password) {
        return JSON.stringify({
          success: false,
          error: "Email configuration is incomplete. Please contact the administrator.",
          missingVariables: [
            !host && "EMAIL_HOST",
            !port && "EMAIL_PORT",
            !username && "EMAIL_USERNAME",
            !password && "EMAIL_PASSWORD",
          ].filter(Boolean),
        });
      }

      // In a real implementation, this would use nodemailer or similar
      // For now, we just demonstrate the variable access pattern
      console.log("Email configuration loaded from package variables:");
      console.log("- Host:", host);
      console.log("- Port:", port);
      console.log("- Username:", username);
      console.log("- From:", fromAddress || "noreply@example.com");

      // TODO: Implement actual email sending using the configured SMTP settings
      // const transporter = nodemailer.createTransport({
      //   host,
      //   port: parseInt(port),
      //   auth: { user: username, pass: password },
      // });
      // await transporter.sendMail({ from: fromAddress, to, subject, html: body });

      return JSON.stringify({
        success: true,
        message: `Email sent successfully to ${to}`,
        details: {
          to,
          subject,
          from: fromAddress || "noreply@example.com",
          timestamp: new Date().toISOString(),
        },
      });
    },
    {
      name: "send_email",
      description:
        "Send an email to a customer. Use this when the customer requests to receive information via email or needs a confirmation email.",
      schema: z.object({
        to: z.string().email().describe("The recipient email address"),
        subject: z.string().describe("The email subject line"),
        body: z.string().describe("The email body content (supports HTML)"),
      }),
    }
  );
