/**
 * Call Feature E2E Test Helpers
 *
 * Common utilities for call feature E2E tests
 */

import { Page, BrowserContext, Browser } from "@playwright/test";

// Get credentials from environment variables
const ADMIN_EMAIL = process.env.E2E_COMPANY_ADMIN_EMAIL || "admin@demo.com";
const ADMIN_PASSWORD = process.env.E2E_COMPANY_ADMIN_PASSWORD || "aaaaaa";

/**
 * Login to the admin dashboard
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/login", { waitUntil: "networkidle", timeout: 60000 });

  // Wait for login form to be ready
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: "visible", timeout: 60000 });

  // Clear and fill email
  await emailInput.click();
  await emailInput.clear();
  await emailInput.pressSequentially(ADMIN_EMAIL, { delay: 30 });

  // Find password input and fill
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.waitFor({ state: "visible", timeout: 10000 });
  await passwordInput.click();
  await passwordInput.clear();
  await passwordInput.pressSequentially(ADMIN_PASSWORD, { delay: 30 });

  // Wait a moment for form state to update
  await page.waitForTimeout(1000);

  // Submit login form
  const submitButton = page.locator('button[type="submit"]');
  await submitButton.waitFor({ state: "visible", timeout: 10000 });
  await submitButton.click();

  // Wait for redirect to dashboard
  await page.waitForURL(/\/(dashboard|conversations|inbox|companies|chatbots)/, { timeout: 60000 });
}

/**
 * Navigate to chatbot settings page
 */
export async function navigateToChatbotSettings(page: Page, chatbotId: string): Promise<void> {
  await page.goto(`/chatbots/${chatbotId}/voice`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to call analytics page
 */
export async function navigateToCallAnalytics(page: Page): Promise<void> {
  await page.goto("/analytics/calls", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to integration accounts page
 */
export async function navigateToIntegrations(page: Page): Promise<void> {
  await page.goto("/integrations", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

/**
 * Open the call widget preview page
 */
export async function openCallWidgetPreview(
  page: Page,
  chatbotId: string,
  companyId: string
): Promise<void> {
  await page.goto(`/preview/call-widget?chatbotId=${chatbotId}&companyId=${companyId}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle");
}

/**
 * Wait for the widget launcher to be ready (config loaded)
 */
export async function waitForWidgetLauncher(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const launcher = document.querySelector(
      'button[aria-label="Open chat"], button[aria-label="Close chat"]'
    );
    return launcher !== null;
  }, { timeout: 60000 });
}

/**
 * Open the widget chat and return the iframe locator
 */
export async function openWidgetChat(
  page: Page,
  chatbotId: string,
  companyId: string
): Promise<ReturnType<Page["frameLocator"]>> {
  await page.goto(`/preview/widget?chatbotId=${chatbotId}&companyId=${companyId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForLoadState("domcontentloaded");

  // Wait for launcher to be ready
  await waitForWidgetLauncher(page);

  // Click launcher to open widget
  const launcher = page.locator('button[aria-label="Open chat"]');
  await launcher.click();

  // Wait for iframe to appear and be loaded
  const iframe = page.frameLocator('iframe[title="Chat Widget"]');

  // Wait for chat header to be visible inside iframe
  await iframe.locator("header").waitFor({ state: "visible", timeout: 30000 });

  return iframe;
}

/**
 * Open the call dialog from the widget
 */
export async function openCallDialog(
  iframe: ReturnType<Page["frameLocator"]>
): Promise<void> {
  // Look for the call button in the header
  const callButton = iframe.locator('button[aria-label="Start voice call"]');

  // Check if call button exists and is visible
  await callButton.waitFor({ state: "visible", timeout: 10000 });
  await callButton.click();

  // Wait for call dialog to appear
  await iframe.locator('[role="dialog"]').waitFor({ state: "visible", timeout: 10000 });
}

/**
 * Start a call from the call dialog
 */
export async function startCall(
  iframe: ReturnType<Page["frameLocator"]>
): Promise<void> {
  // Click the start call button (icon-only button with aria-label)
  const startCallButton = iframe.locator('button[aria-label="Start Call"]');
  await startCallButton.waitFor({ state: "visible", timeout: 10000 });
  await startCallButton.click();
}

/**
 * End an active call
 */
export async function endCall(
  iframe: ReturnType<Page["frameLocator"]>
): Promise<void> {
  // Click the end call button
  const endCallButton = iframe.locator('button[aria-label="End call"], button:has-text("End Call")');
  await endCallButton.waitFor({ state: "visible", timeout: 10000 });
  await endCallButton.click();
}

/**
 * Wait for call to reach a specific status
 */
export async function waitForCallStatus(
  iframe: ReturnType<Page["frameLocator"]>,
  status: "connecting" | "connected" | "ended" | "error"
): Promise<void> {
  const statusMap: Record<string, string> = {
    connecting: "Connecting",
    connected: "Connected",
    ended: "Call ended",
    error: "Error",
  };

  await iframe.getByText(statusMap[status] || status).waitFor({
    state: "visible",
    timeout: 30000,
  });
}

/**
 * Check if call button is visible in widget
 */
export async function isCallButtonVisible(
  iframe: ReturnType<Page["frameLocator"]>
): Promise<boolean> {
  const callButton = iframe.locator('button[aria-label="Start voice call"]');
  return callButton.isVisible();
}

/**
 * Toggle mute in an active call
 */
export async function toggleMute(
  iframe: ReturnType<Page["frameLocator"]>
): Promise<void> {
  const muteButton = iframe.locator('button[aria-label="Mute"], button[aria-label="Unmute"]');
  await muteButton.click();
}

/**
 * Check if audio visualizer is active
 */
export async function isVisualizerActive(
  iframe: ReturnType<Page["frameLocator"]>
): Promise<boolean> {
  // Look for canvas or animated visualizer element
  const visualizer = iframe.locator('canvas, [class*="visualizer"]');
  return visualizer.isVisible();
}

/**
 * Download call transcript
 */
export async function downloadTranscript(
  iframe: ReturnType<Page["frameLocator"]>,
  page: Page
): Promise<string | null> {
  // Click download button
  const downloadButton = iframe.locator('button[aria-label="Download transcript"]');

  if (!(await downloadButton.isVisible())) {
    return null;
  }

  // Wait for download
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    downloadButton.click(),
  ]);

  // Get download path
  const path = await download.path();
  return path;
}

/**
 * Grant microphone permission to browser context
 */
export async function grantMicrophonePermission(context: BrowserContext): Promise<void> {
  await context.grantPermissions(["microphone"]);
}

/**
 * Create a browser context with microphone permission
 */
export async function createContextWithMicrophone(
  browser: Browser
): Promise<BrowserContext> {
  const context = await browser.newContext({
    permissions: ["microphone"],
  });
  return context;
}

/**
 * Wait for network idle after an action
 */
export async function waitForNetworkIdle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 30000 });
}

/**
 * Get the current call duration from UI
 */
export async function getCallDuration(
  iframe: ReturnType<Page["frameLocator"]>
): Promise<string | null> {
  const durationElement = iframe.locator('[data-testid="call-duration"], .call-duration');
  if (await durationElement.isVisible()) {
    return durationElement.textContent();
  }
  return null;
}

/**
 * Check if transcript panel is visible
 */
export async function isTranscriptVisible(
  iframe: ReturnType<Page["frameLocator"]>
): Promise<boolean> {
  const transcriptPanel = iframe.locator('[data-testid="transcript-panel"], .transcript-panel');
  return transcriptPanel.isVisible();
}

/**
 * Toggle transcript visibility
 */
export async function toggleTranscript(
  iframe: ReturnType<Page["frameLocator"]>
): Promise<void> {
  const transcriptToggle = iframe.locator('button[aria-label="Toggle transcript"]');
  await transcriptToggle.click();
}

/**
 * Get call error message
 */
export async function getCallErrorMessage(
  iframe: ReturnType<Page["frameLocator"]>
): Promise<string | null> {
  const errorElement = iframe.locator('[data-testid="call-error"], .call-error');
  if (await errorElement.isVisible()) {
    return errorElement.textContent();
  }
  return null;
}
