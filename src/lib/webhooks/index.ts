/**
 * Webhooks Module
 *
 * Handles webhook security including IP allowlisting, rate limiting, and signature verification.
 */

export {
  WebhookSecurityService,
  getWebhookSecurityService,
  validateWebhookRequest,
  isIPAllowed,
  type IPAllowlistEntry,
  type WebhookSecurityConfig,
  type ValidationResult,
} from "./security";
