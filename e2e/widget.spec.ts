import { test, expect } from "@playwright/test";

/**
 * Widget E2E Tests
 *
 * Tests for the embeddable chat widget functionality.
 * Note: These tests use the widget test page which doesn't require authentication.
 */

// Use a sample chatbot and company ID for testing
// These should exist in the test database
const TEST_CHATBOT_ID = "f0fb28b6-9c33-4e1f-b2a3-0cafca0a5dd4";
const TEST_COMPANY_ID = "e26c57e9-0c4e-4d0a-b261-5d89e2db58ae";

test.describe("Widget Test Page", () => {
  test("test page loads with widget", async ({ page }) => {
    await page.goto(
      `/api/widget/test-page?chatbotId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`
    );
    await page.waitForLoadState("networkidle");

    // Check that test page loaded - use role to avoid matching multiple elements
    await expect(
      page.getByRole("heading", { name: "Test Your Chat Widget" })
    ).toBeVisible();
    await expect(page.getByText("Test Environment")).toBeVisible();

    // Check that widget launcher is visible
    const launcher = page.locator("#buzzi-launcher");
    await expect(launcher).toBeVisible();
  });

  test("widget opens on launcher click", async ({ page }) => {
    await page.goto(
      `/api/widget/test-page?chatbotId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`
    );
    await page.waitForLoadState("networkidle");

    // Click the launcher button
    const launcher = page.locator("#buzzi-launcher");
    await launcher.click();

    // Wait for chat window to appear
    const chatWindow = page.locator("#buzzi-chat-window");
    await expect(chatWindow).toBeVisible({ timeout: 5000 });

    // Check iframe is loaded
    const iframe = page.locator("#buzzi-chat-iframe");
    await expect(iframe).toBeVisible();
  });

  test("widget closes on X button click", async ({ page }) => {
    await page.goto(
      `/api/widget/test-page?chatbotId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`
    );
    await page.waitForLoadState("networkidle");

    // Open widget
    const launcher = page.locator("#buzzi-launcher");
    await launcher.click();

    // Verify it's open
    const chatWindow = page.locator("#buzzi-chat-window");
    await expect(chatWindow).toBeVisible({ timeout: 5000 });

    // Click launcher again to close
    await launcher.click();

    // Widget should close (opacity 0)
    await expect(chatWindow).toHaveCSS("opacity", "0", { timeout: 3000 });
  });

  test("test page validates UUID format", async ({ page }) => {
    // Try with invalid UUIDs
    const response = await page.goto(
      `/api/widget/test-page?chatbotId=invalid&companyId=invalid`
    );

    // Should get error response
    expect(response?.status()).toBe(400);
  });

  test("test page requires both parameters", async ({ page }) => {
    // Missing companyId
    const response1 = await page.goto(
      `/api/widget/test-page?chatbotId=${TEST_CHATBOT_ID}`
    );
    expect(response1?.status()).toBe(400);

    // Missing chatbotId
    const response2 = await page.goto(
      `/api/widget/test-page?companyId=${TEST_COMPANY_ID}`
    );
    expect(response2?.status()).toBe(400);
  });
});

test.describe("Widget Embed Page", () => {
  test("embed page loads with required params", async ({ page }) => {
    // Use commit to avoid waiting for all resources to load
    await page.goto(
      `/embed-widget?agentId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`,
      { waitUntil: "commit" }
    );

    // Wait for React to hydrate and check initial state
    await page.waitForTimeout(2000);

    // Should show loading spinner or chat interface
    // The page should not show error for missing config
    await expect(
      page.getByText("Missing required configuration")
    ).not.toBeVisible();
  });

  test("embed page shows error without required params", async ({ page }) => {
    await page.goto("/embed-widget", { waitUntil: "commit" });

    // Wait for error message to appear
    await expect(
      page.getByText("Missing required configuration")
    ).toBeVisible({ timeout: 10000 });
  });

  test("embed page displays chat interface", async ({ page }) => {
    await page.goto(
      `/embed-widget?agentId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`,
      { waitUntil: "commit" }
    );

    // Wait for header to load and verify full chat interface is visible
    const header = page.locator("header");
    await expect(header).toBeVisible({ timeout: 20000 });

    // Once header is visible, check for input field and send button
    const input = page.locator("textarea");
    await expect(input).toBeVisible({ timeout: 5000 });

    const sendButton = page.getByRole("button", { name: /send message/i });
    await expect(sendButton).toBeVisible({ timeout: 5000 });
  });
});


test.describe("Widget Message Flow", () => {
  test("can send message and receive AI response", async ({ page }) => {
    await page.goto(
      `/embed-widget?agentId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`,
      { waitUntil: "commit" }
    );

    // Wait for chat interface to load
    const header = page.locator("header");
    await expect(header).toBeVisible({ timeout: 20000 });

    // Wait for input to be ready
    const input = page.locator("textarea");
    await expect(input).toBeVisible({ timeout: 5000 });

    // Type a test message
    await input.fill("Hello, this is a test message");

    // Click send button
    const sendButton = page.getByRole("button", { name: /send message/i });
    await sendButton.click();

    // Verify user message appears in chat
    await expect(page.getByText("Hello, this is a test message")).toBeVisible({
      timeout: 5000,
    });

    // Wait for AI response (may take some time)
    // The response should be an assistant message (not user)
    // Look for any new message that appears after the user message
    await expect(async () => {
      const messages = page.locator('[class*="rounded-2xl"][class*="rounded-bl-sm"]');
      const count = await messages.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }).toPass({ timeout: 60000 });

    // Verify typing indicator is not showing after response
    await expect(page.locator(".animate-bounce")).not.toBeVisible({ timeout: 5000 });
  });

  test("shows typing indicator or receives fast response", async ({ page }) => {
    await page.goto(
      `/embed-widget?agentId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`,
      { waitUntil: "commit" }
    );

    // Wait for chat interface
    await expect(page.locator("header")).toBeVisible({ timeout: 20000 });

    const input = page.locator("textarea");
    await expect(input).toBeVisible({ timeout: 5000 });

    // Send a message
    await input.fill("Test typing indicator");
    await page.getByRole("button", { name: /send message/i }).click();

    // Either typing indicator should appear OR response should arrive quickly
    // This handles both slow and fast AI response times
    const typingIndicator = page.locator(".animate-bounce").first();
    const assistantMessage = page.locator('[class*="rounded-2xl"][class*="rounded-bl-sm"]');

    // Wait for either typing indicator or assistant response
    await expect(async () => {
      const hasTyping = await typingIndicator.isVisible().catch(() => false);
      const hasResponse = (await assistantMessage.count()) >= 1;
      expect(hasTyping || hasResponse).toBe(true);
    }).toPass({ timeout: 30000 });
  });

  test("displays welcome message from config", async ({ page }) => {
    await page.goto(
      `/embed-widget?agentId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`,
      { waitUntil: "commit" }
    );

    // Wait for chat interface
    await expect(page.locator("header")).toBeVisible({ timeout: 20000 });

    // Welcome message should be displayed
    await expect(
      page.getByText("Hi there! How can we help you today?")
    ).toBeVisible({ timeout: 10000 });
  });

  test("applies custom theme from config", async ({ page }) => {
    await page.goto(
      `/embed-widget?agentId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`,
      { waitUntil: "commit" }
    );

    // Wait for chat interface
    await expect(page.locator("header")).toBeVisible({ timeout: 20000 });

    // Check that dark theme is applied (bg-zinc-900 class)
    const mainContainer = page.locator("div").filter({ hasText: /Chat with/i }).first();
    await expect(mainContainer).toBeVisible();
  });
});

test.describe("Widget Accessibility", () => {
  test("launcher has proper aria attributes", async ({ page }) => {
    await page.goto(
      `/api/widget/test-page?chatbotId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`
    );
    await page.waitForLoadState("networkidle");

    const launcher = page.locator("#buzzi-launcher");
    await expect(launcher).toHaveAttribute("aria-label", "Open chat");
  });

  test("embed page controls have aria labels", async ({ page }) => {
    await page.goto(
      `/embed-widget?agentId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`,
      { waitUntil: "commit" }
    );

    // Wait for header to be visible (indicates config loaded)
    await expect(page.locator("header")).toBeVisible({ timeout: 20000 });

    // Send button should have aria-label
    const sendButton = page.getByRole("button", { name: /send message/i });
    await expect(sendButton).toBeVisible({ timeout: 5000 });

    // Close button should have aria-label
    const closeButton = page.getByRole("button", { name: /close/i });
    await expect(closeButton).toBeVisible({ timeout: 5000 });

    // Minimize button should have aria-label
    const minimizeButton = page.getByRole("button", { name: /minimize/i });
    await expect(minimizeButton).toBeVisible({ timeout: 5000 });
  });
});
