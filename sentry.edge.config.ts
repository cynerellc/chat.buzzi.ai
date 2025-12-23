/**
 * Sentry Edge Configuration
 *
 * This file configures the initialization of Sentry for edge features (middleware, edge routes, etc).
 * The config you add here will be used whenever one of the edge features is loaded.
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
});
