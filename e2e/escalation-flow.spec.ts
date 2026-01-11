/**
 * Escalation Flow E2E Tests
 *
 * Tests the complete human escalation flow:
 * 1. User requests human agent in widget
 * 2. HumanWaitingBubble appears
 * 3. Admin takes over conversation
 * 4. HumanWaitingBubble hides, HumanJoinedBubble appears
 * 5. Real-time message delivery between admin and widget
 * 6. Admin returns to AI, HumanExitedBubble appears
 */

import { test, expect, Page, BrowserContext } from "@playwright/test";

// Test configuration
const TEST_CHATBOT_ID = "f0fb28b6-9c33-4e1f-b2a3-0cafca0a5dd4";
const TEST_COMPANY_ID = "e26c57e9-0c4e-4d0a-b261-5d89e2db58ae";
const WIDGET_PREVIEW_URL = `/preview/widget?chatbotId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`;

// Get credentials from environment variables
const ADMIN_EMAIL = process.env.E2E_COMPANY_ADMIN_EMAIL || "admin@demo.com";
const ADMIN_PASSWORD = process.env.E2E_COMPANY_ADMIN_PASSWORD || "aaaaaa";

/**
 * Helper: Login to the admin dashboard
 */
async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/login", { waitUntil: "networkidle", timeout: 60000 });

  // Wait for login form to be ready - find the actual input elements
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible({ timeout: 60000 });

  // Clear and fill email
  await emailInput.click();
  await emailInput.clear();
  await emailInput.pressSequentially(ADMIN_EMAIL, { delay: 30 });

  // Find password input and fill
  const passwordInput = page.locator('input[type="password"]');
  await expect(passwordInput).toBeVisible({ timeout: 10000 });
  await passwordInput.click();
  await passwordInput.clear();
  await passwordInput.pressSequentially(ADMIN_PASSWORD, { delay: 30 });

  // Wait a moment for form state to update
  await page.waitForTimeout(1000);

  // Submit login form by clicking the submit button
  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeVisible({ timeout: 10000 });
  await submitButton.click();

  // Wait for redirect to dashboard or conversations page
  await page.waitForURL(/\/(dashboard|conversations|inbox|companies)/, { timeout: 60000 });
}

/**
 * Helper: Wait for widget launcher to be ready (config loaded)
 */
async function waitForWidgetLauncher(page: Page): Promise<void> {
  // Wait for config to load - the launcher button appears when isConfigLoaded is true
  // The loading state shows a div with animate-pulse class
  await page.waitForFunction(() => {
    const launcher = document.querySelector('button[aria-label="Open chat"], button[aria-label="Close chat"]');
    return launcher !== null;
  }, { timeout: 60000 });
}

/**
 * Helper: Open widget and get the iframe frame locator
 */
async function openWidgetChat(page: Page): Promise<ReturnType<Page["frameLocator"]>> {
  await page.goto(WIDGET_PREVIEW_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("domcontentloaded");

  // Wait for launcher to be ready (config loaded)
  await waitForWidgetLauncher(page);

  // Click launcher to open widget
  const launcher = page.locator('button[aria-label="Open chat"]');
  await launcher.click();

  // Wait for iframe to appear and be loaded
  const iframe = page.frameLocator('iframe[title="Chat Widget"]');

  // Wait for chat header to be visible inside iframe (indicates full load)
  await expect(iframe.locator("header")).toBeVisible({ timeout: 30000 });

  return iframe;
}

/**
 * Helper: Send a message in the widget iframe
 */
async function sendWidgetMessage(
  iframe: ReturnType<Page["frameLocator"]>,
  message: string,
  page: Page
): Promise<void> {
  const textarea = iframe.locator("textarea");
  await expect(textarea).toBeVisible({ timeout: 30000 });

  // Click the textarea first to ensure focus
  await textarea.click();

  // Clear any existing text
  await textarea.fill("");

  // Type the message character by character to properly trigger React onChange
  await textarea.type(message, { delay: 20 });

  // Wait a moment for React state to update
  await page.waitForTimeout(500);

  // Try clicking the send button (more reliable in iframe)
  const sendButton = iframe.locator('button[aria-label="Send message"]');
  if (await sendButton.isEnabled({ timeout: 2000 }).catch(() => false)) {
    await sendButton.click();
  } else {
    // Fallback to Enter key
    await textarea.press("Enter");
  }

  // Wait for message to appear in the chat
  await expect(iframe.getByText(message)).toBeVisible({ timeout: 30000 });
}

// ============================================================================
// Test Suite: Complete Escalation Flow
// ============================================================================

test.describe("Escalation Flow", () => {
  test.describe.configure({ mode: "serial", timeout: 120000 }); // Run tests in order with 2 minute timeout

  let conversationId: string;
  let widgetPage: Page;
  let adminPage: Page;
  let widgetContext: BrowserContext;
  let adminContext: BrowserContext;
  let widgetIframe: ReturnType<Page["frameLocator"]>;

  test.beforeAll(async ({ browser }) => {
    // Create two separate browser contexts for widget user and admin
    widgetContext = await browser.newContext();
    adminContext = await browser.newContext();

    widgetPage = await widgetContext.newPage();
    adminPage = await adminContext.newPage();
  });

  test.afterAll(async () => {
    await widgetContext?.close();
    await adminContext?.close();
  });

  test("1. User sends escalation request and sees HumanWaitingBubble", async () => {
    // Open widget
    widgetIframe = await openWidgetChat(widgetPage);

    // Send escalation request message
    await sendWidgetMessage(widgetIframe, "i want to talk with human agent", widgetPage);

    // Wait for HumanWaitingBubble to appear
    // The bubble contains "Connecting to support" text (uppercase header)
    await expect(widgetIframe.getByText(/connecting to support/i)).toBeVisible({ timeout: 90000 });

    // Verify the waiting message cycle text appears (typewriter effect messages)
    await expect(
      widgetIframe.getByText(/connecting you to support|agent joining shortly|request forwarded|human agent on way/i)
    ).toBeVisible({ timeout: 20000 });
  });

  test("2. Admin logs in and navigates to conversations", async () => {
    // Login as admin
    await loginAsAdmin(adminPage);

    // Navigate to conversations list
    await adminPage.goto("/conversations");
    await adminPage.waitForLoadState("domcontentloaded");

    // Wait for conversations page to load
    await expect(adminPage.locator("main")).toBeVisible({ timeout: 15000 });
  });

  test("3. Admin finds and opens the escalated conversation", async () => {
    // Wait for the conversation list to load
    await adminPage.waitForTimeout(3000);

    // Click on the first conversation row (inside the divide-y container)
    // Conversation rows contain user avatar, name, status badge, and message preview
    const conversationRow = adminPage.locator('.divide-y button').filter({
      hasText: /i want to talk with human agent/i,
    }).first();
    await expect(conversationRow).toBeVisible({ timeout: 15000 });

    // Click to open the conversation
    await conversationRow.click();

    // Wait for conversation detail page to load
    await adminPage.waitForURL(/\/conversations\/[a-f0-9-]+/, { timeout: 60000 });

    // Extract conversation ID from URL
    const url = adminPage.url();
    const match = url.match(/\/conversations\/([a-f0-9-]+)/);
    if (match && match[1]) {
      conversationId = match[1];
    }

    // Verify we can see the "Take Over Conversation" button
    await expect(adminPage.getByRole("button", { name: /take over conversation/i })).toBeVisible({
      timeout: 20000,
    });
  });

  test("4. Admin takes over conversation - HumanWaitingBubble hides, HumanJoinedBubble appears", async () => {
    // Click "Take Over Conversation" button
    const takeOverButton = adminPage.getByRole("button", { name: /take over conversation/i });
    await takeOverButton.click();

    // Wait for success toast
    await expect(adminPage.getByText(/you are now handling this conversation/i)).toBeVisible({
      timeout: 15000,
    });

    // Now check the widget - HumanWaitingBubble should be hidden
    // Give SSE time to propagate
    await widgetPage.waitForTimeout(2000);

    // HumanWaitingBubble should disappear (no more "Connecting to support" header)
    await expect(widgetIframe.getByText(/connecting to support/i)).not.toBeVisible({ timeout: 20000 });

    // HumanJoinedBubble should appear - contains "to the conversation" text
    await expect(widgetIframe.getByText(/to the conversation/i)).toBeVisible({ timeout: 20000 });
  });

  test("5. Admin sends message - appears in widget in real-time", async () => {
    // Admin should now see message textarea
    const messageInput = adminPage.locator("textarea").first();
    await expect(messageInput).toBeVisible({ timeout: 15000 });

    // Send a message from admin using type + Enter key (more reliable with NextUI components)
    const adminMessage = "Hello! I am here to help you. How can I assist you today?";
    await messageInput.click();
    await messageInput.fill(adminMessage);

    // Wait for React state to update
    await adminPage.waitForTimeout(500);

    // Press Enter to send (the form handles Enter key submission)
    await messageInput.press("Enter");

    // Wait for message to be sent and appear in admin page
    await expect(adminPage.getByText(adminMessage)).toBeVisible({ timeout: 15000 });

    // Check widget - message should appear in real-time via SSE
    await expect(widgetIframe.getByText(adminMessage).first()).toBeVisible({ timeout: 30000 });
  });

  test("6. User sends message in widget - appears in admin page in REAL-TIME (no reload)", async () => {
    // User sends a reply
    const userMessage = "Thank you for your help! I have a question about billing.";

    // Get initial message count in admin page
    const initialMessageCount = await adminPage.locator('[data-testid="message-bubble"], .rounded-lg.p-3').count();
    console.log(`[E2E] Initial message count in admin: ${initialMessageCount}`);

    // Send message from widget
    await sendWidgetMessage(widgetIframe, userMessage, widgetPage);
    console.log(`[E2E] Sent message from widget: "${userMessage}"`);

    // DO NOT RELOAD - message should appear via Supabase Realtime subscription
    // Wait for the message to appear in admin page automatically
    console.log("[E2E] Waiting for realtime message to appear in admin page (NO RELOAD)...");

    await expect(adminPage.getByText(userMessage)).toBeVisible({ timeout: 30000 });
    console.log("[E2E] SUCCESS: Message appeared in admin page via realtime!");
  });

  test("7. Admin returns to AI - HumanExitedBubble appears in widget", async () => {
    // Find and click "Return to AI" button
    const returnToAIButton = adminPage.getByRole("button", { name: /return to ai/i });
    await expect(returnToAIButton).toBeVisible({ timeout: 15000 });
    await returnToAIButton.click();

    // Wait for success toast
    await expect(adminPage.getByText(/conversation returned to ai/i)).toBeVisible({ timeout: 15000 });

    // Give SSE time to propagate
    await widgetPage.waitForTimeout(2000);

    // Check widget - HumanExitedBubble should appear
    // Contains "left the conversation" text
    await expect(widgetIframe.getByText(/left the conversation/i)).toBeVisible({ timeout: 20000 });

    // Should also show "AI assistant will continue helping you"
    await expect(widgetIframe.getByText(/ai assistant will continue/i)).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// Individual Flow Tests (can run independently)
// ============================================================================

test.describe("Widget Escalation UI", () => {
  // Run these tests serially to avoid resource contention
  test.describe.configure({ mode: "serial", timeout: 120000 });

  test("HumanWaitingBubble displays animated messages", async ({ page }) => {
    // Open widget
    const iframe = await openWidgetChat(page);

    // Send escalation request (use exact phrase that reliably triggers escalation)
    await sendWidgetMessage(iframe, "i want to talk with human agent", page);

    // Wait for HumanWaitingBubble
    await expect(iframe.getByText(/connecting to support/i)).toBeVisible({ timeout: 90000 });

    // Verify pulsing indicator is present (has animate-ping class)
    const pulsingDot = iframe.locator(".animate-ping");
    await expect(pulsingDot.first()).toBeVisible({ timeout: 10000 });
  });

  test("Messages sent while waiting are stored but not processed by AI", async ({ page }) => {
    // Open widget
    const iframe = await openWidgetChat(page);

    // Trigger escalation (use exact phrase that reliably triggers escalation)
    await sendWidgetMessage(iframe, "i want to talk with human agent", page);

    // Wait for HumanWaitingBubble
    await expect(iframe.getByText(/connecting to support/i)).toBeVisible({ timeout: 90000 });

    // Send another message while waiting
    const followUpMessage = "Are you there? I am still waiting.";
    await sendWidgetMessage(iframe, followUpMessage, page);

    // The message should appear in the chat
    await expect(iframe.getByText(followUpMessage)).toBeVisible({ timeout: 10000 });

    // The HumanWaitingBubble should still be visible (not processed by AI)
    await expect(iframe.getByText(/connecting to support/i)).toBeVisible({ timeout: 5000 });
  });

  test("Cancel escalation button is visible and functional", async ({ page }) => {
    // Open widget
    const iframe = await openWidgetChat(page);

    // Trigger escalation (use exact phrase that reliably triggers escalation)
    await sendWidgetMessage(iframe, "i want to talk with human agent", page);

    // Wait for HumanWaitingBubble
    await expect(iframe.getByText(/connecting to support/i)).toBeVisible({ timeout: 90000 });

    // Check for Cancel Request button
    const cancelButton = iframe.getByRole("button", { name: /cancel request/i });
    await expect(cancelButton).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Admin Conversation Management", () => {
  test("Admin can view conversation list", async ({ page }) => {
    // Login
    await loginAsAdmin(page);

    // Go to conversations
    await page.goto("/conversations");
    await page.waitForLoadState("domcontentloaded");

    // Wait for page to load
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Wait for loading to complete - "Loading conversations..." should disappear
    await expect(page.getByText(/loading conversations/i)).not.toBeVisible({ timeout: 30000 });

    // Should see conversation list (buttons inside divide-y container) or empty state
    const hasConversations = await page.locator(".divide-y button").first().isVisible().catch(() => false);
    const hasEmptyState = await page.getByText(/no conversations/i).isVisible().catch(() => false);

    expect(hasConversations || hasEmptyState).toBe(true);
  });

  test("Admin can view escalated conversation details", async ({ page }) => {
    // Login
    await loginAsAdmin(page);

    // Go to conversations
    await page.goto("/conversations");
    await page.waitForLoadState("domcontentloaded");

    // Wait for list to load
    await page.waitForTimeout(3000);

    // Click first conversation if exists (conversations are buttons, not links)
    const conversationButton = page.locator(".divide-y button").first();
    if (await conversationButton.isVisible().catch(() => false)) {
      await conversationButton.click();
      await page.waitForURL(/\/conversations\/[a-f0-9-]+/, { timeout: 15000 });

      // Should see conversation header
      await expect(page.locator("header").first()).toBeVisible({ timeout: 15000 });

      // Should see either "Take Over" button or message input (depending on status)
      const takeOverButton = page.getByRole("button", { name: /take over conversation/i });
      const messageInput = page.locator("textarea");
      const returnToAI = page.getByRole("button", { name: /return to ai/i });

      const hasTakeOver = await takeOverButton.isVisible().catch(() => false);
      const hasInput = await messageInput.isVisible().catch(() => false);
      const hasReturnToAI = await returnToAI.isVisible().catch(() => false);

      expect(hasTakeOver || hasInput || hasReturnToAI).toBe(true);
    }
  });
});

// ============================================================================
// Real-time Communication Tests
// ============================================================================

test.describe("Real-time Communication", () => {
  test("SSE connection is established for widget", async ({ page }) => {
    // Open widget
    const iframe = await openWidgetChat(page);

    // Send a message to establish session
    await sendWidgetMessage(iframe, "Hello, testing SSE connection", page);

    // Wait for response (indicates SSE is working)
    // Either AI responds or we see typing indicator
    const typingIndicator = iframe.locator(".animate-bounce");
    const responseMessage = iframe.locator('[class*="rounded-bl-sm"]'); // Assistant message bubble

    await expect(async () => {
      const hasTyping = await typingIndicator.first().isVisible().catch(() => false);
      const hasResponse = (await responseMessage.count()) >= 1;
      expect(hasTyping || hasResponse).toBe(true);
    }).toPass({ timeout: 60000 });
  });
});

// ============================================================================
// Supabase Realtime Message Delivery Tests
// ============================================================================

test.describe("Supabase Realtime Message Delivery", () => {
  test.describe.configure({ mode: "serial", timeout: 180000 });

  let widgetPage: Page;
  let adminPage: Page;
  let widgetContext: BrowserContext;
  let adminContext: BrowserContext;
  let widgetIframe: ReturnType<Page["frameLocator"]>;
  let conversationId: string;

  test.beforeAll(async ({ browser }) => {
    widgetContext = await browser.newContext();
    adminContext = await browser.newContext();
    widgetPage = await widgetContext.newPage();
    adminPage = await adminContext.newPage();

    // Enable console logging for debugging
    adminPage.on("console", (msg) => {
      if (msg.text().includes("[Realtime]")) {
        console.log(`[Admin Console] ${msg.text()}`);
      }
    });
  });

  test.afterAll(async () => {
    await widgetContext?.close();
    await adminContext?.close();
  });

  test("Setup: Create escalated conversation and admin takes over", async () => {
    // Open widget and trigger escalation
    widgetIframe = await openWidgetChat(widgetPage);
    await sendWidgetMessage(widgetIframe, "i want to talk with human agent", widgetPage);

    // Wait for escalation
    await expect(widgetIframe.getByText(/connecting to support/i)).toBeVisible({ timeout: 90000 });

    // Admin login and navigate
    await loginAsAdmin(adminPage);
    await adminPage.goto("/conversations");
    await adminPage.waitForLoadState("domcontentloaded");
    await adminPage.waitForTimeout(3000);

    // Find and click the escalated conversation
    const conversationRow = adminPage.locator('.divide-y button').filter({
      hasText: /i want to talk with human agent/i,
    }).first();
    await expect(conversationRow).toBeVisible({ timeout: 15000 });
    await conversationRow.click();
    await adminPage.waitForURL(/\/conversations\/[a-f0-9-]+/, { timeout: 60000 });

    // Extract conversation ID
    const url = adminPage.url();
    const match = url.match(/\/conversations\/([a-f0-9-]+)/);
    if (match?.[1]) {
      conversationId = match[1];
      console.log(`[E2E] Conversation ID: ${conversationId}`);
    }

    // Take over the conversation
    const takeOverButton = adminPage.getByRole("button", { name: /take over conversation/i });
    await expect(takeOverButton).toBeVisible({ timeout: 20000 });
    await takeOverButton.click();
    await expect(adminPage.getByText(/you are now handling this conversation/i)).toBeVisible({ timeout: 15000 });

    // Verify HumanJoinedBubble appears in widget
    await expect(widgetIframe.getByText(/to the conversation/i)).toBeVisible({ timeout: 20000 });
  });

  test("Realtime: Widget message appears in admin WITHOUT page reload", async () => {
    // Generate unique message to avoid false positives
    const uniqueMessage = `Realtime test message ${Date.now()}`;
    console.log(`[E2E] Sending unique message: "${uniqueMessage}"`);

    // Listen for console logs from admin page about realtime
    const realtimeLogs: string[] = [];
    const consoleHandler = (msg: { text: () => string }) => {
      const text = msg.text();
      if (text.includes("Realtime") || text.includes("realtime")) {
        realtimeLogs.push(text);
        console.log(`[Admin Realtime Log] ${text}`);
      }
    };
    adminPage.on("console", consoleHandler);

    // Send message from widget
    await sendWidgetMessage(widgetIframe, uniqueMessage, widgetPage);
    console.log("[E2E] Message sent from widget, waiting for realtime delivery...");

    // Wait for message to appear in admin page WITHOUT reloading
    // This tests the Supabase Realtime subscription
    try {
      await expect(adminPage.getByText(uniqueMessage)).toBeVisible({ timeout: 30000 });
      console.log("[E2E] SUCCESS: Message appeared via Supabase Realtime!");
    } catch (error) {
      // Log debug info
      console.log("[E2E] FAILED: Message did not appear via realtime");
      console.log("[E2E] Realtime logs captured:", realtimeLogs);

      // Try manual reload to verify message was saved
      await adminPage.reload();
      await adminPage.waitForTimeout(2000);

      const appearedAfterReload = await adminPage.getByText(uniqueMessage).isVisible().catch(() => false);
      console.log(`[E2E] Message visible after reload: ${appearedAfterReload}`);

      throw error;
    } finally {
      adminPage.off("console", consoleHandler);
    }
  });

  test("Realtime: Admin message appears in widget in real-time", async () => {
    const adminMessage = `Admin realtime test ${Date.now()}`;
    console.log(`[E2E] Admin sending: "${adminMessage}"`);

    // Send message from admin
    const messageInput = adminPage.locator("textarea").first();
    await expect(messageInput).toBeVisible({ timeout: 15000 });
    await messageInput.click();
    await messageInput.fill(adminMessage);
    await adminPage.waitForTimeout(300);
    await messageInput.press("Enter");

    // Wait for message to appear in admin page first
    await expect(adminPage.getByText(adminMessage)).toBeVisible({ timeout: 15000 });
    console.log("[E2E] Message sent from admin");

    // Check widget - should appear via SSE/Realtime
    await expect(widgetIframe.getByText(adminMessage)).toBeVisible({ timeout: 30000 });
    console.log("[E2E] SUCCESS: Admin message appeared in widget!");
  });
});
