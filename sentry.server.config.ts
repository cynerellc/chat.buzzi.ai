/**
 * Sentry Server Configuration
 *
 * This file configures the initialization of Sentry on the server.
 * The config you add here will be used whenever the server handles a request.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring sample rate
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Enable debug mode in development
  debug: process.env.NODE_ENV === "development",

  // Only send errors in production
  enabled: process.env.NODE_ENV === "production",

  // Environment configuration
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

  // Before sending callback - filter out sensitive data
  beforeSend(event) {
    // Remove any PII from the event
    if (event.user) {
      delete event.user.ip_address;
    }

    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }

    return event;
  },

  // Ignore certain errors
  ignoreErrors: [
    // Next.js specific errors that are handled
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
  ],

  // Spotlight for development
  spotlight: process.env.NODE_ENV === "development",
});
