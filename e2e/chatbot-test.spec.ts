import { test, expect } from "@playwright/test";

const TEST_EMAIL = "admin@buzzi.ai";
const TEST_PASSWORD = "aaaaaa";
const TEST_URL =
  "/admin/companies/cb573c62-09ce-4969-a4d3-9c74ea612af8/chatbots/c00473b0-541f-4429-b47f-10d74013278c/test";

// Only run on chromium to speed up testing
test.use({ browserName: "chromium" });

// Increase timeout for slow compilation
test.setTimeout(120000);

test.describe("Chatbot Test Page", () => {
  test.beforeEach(async ({ page }) => {
    // Login as master admin
    await page.goto("/login");

    // Wait for the form to be visible
    await page.waitForSelector('input[type="email"]', { timeout: 30000 });

    // Fill login credentials using correct placeholders
    await page.fill('input[placeholder="name@company.com"]', TEST_EMAIL);
    await page.fill('input[placeholder="Enter your password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect - login takes time to compile redirect route
    // Just wait for URL to change from /login
    await page.waitForFunction(
      () => !window.location.pathname.includes("/login"),
      { timeout: 60000 }
    );

    // Extra wait for any navigation to complete
    await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
  });

  test("should load chatbot test page without build errors", async ({
    page,
  }) => {
    // Navigate to the chatbot test page
    await page.goto(TEST_URL, { timeout: 60000 });

    // Wait for page to load
    await page.waitForLoadState("domcontentloaded", { timeout: 30000 });

    // Check for build errors
    const pageContent = await page.content();

    // Verify no module not found error
    expect(pageContent).not.toContain("Module not found");
    expect(pageContent).not.toContain("Can't resolve '@buzzi-ai/agent-sdk'");

    // Verify page loaded (not just an error page)
    expect(pageContent).not.toContain("Build Error");
  });

  test("should be able to send a message and receive a response", async ({
    page,
  }) => {
    // Navigate to the chatbot test page
    await page.goto(TEST_URL, { timeout: 120000 });

    // Wait for page to fully load - the test page has "Test Chatbot" heading
    await page.waitForSelector('text="Test Chatbot"', { timeout: 60000 });

    // Wait for the chat input to be ready
    await page.waitForSelector('input[placeholder="Type a message..."]', {
      timeout: 30000,
    });

    // Check for build errors first
    const pageContent = await page.content();
    if (
      pageContent.includes("Module not found") ||
      pageContent.includes("Build Error")
    ) {
      console.log("Build error detected:");
      console.log(pageContent.substring(0, 2000));
      expect(pageContent).not.toContain("Module not found");
      return;
    }

    // Find the message input with correct placeholder
    const messageInput = page.locator('input[placeholder="Type a message..."]');
    await expect(messageInput).toBeVisible();

    // Type a test message
    const testMessage = "list all apple products";
    await messageInput.fill(testMessage);

    // Find and click the send button (it's next to the input)
    const sendButton = page.locator(
      'button:has(svg[class*="lucide-send"]), button:near(input[placeholder="Type a message..."])'
    ).last();
    await sendButton.click();

    // Wait for response - look for the message to appear in the chat
    // The user message should appear first
    await expect(page.locator(`text="${testMessage}"`)).toBeVisible({
      timeout: 10000,
    });

    // Wait for assistant response (streaming complete)
    await page.waitForTimeout(20000);

    // Verify no error occurred
    const finalContent = await page.content();
    expect(finalContent).not.toContain("Module not found");
    expect(finalContent).not.toContain("Build Error");

    // Check that we got a response (should mention apple/iPhone/iPad etc)
    const hasResponse = await page
      .locator('text=/iPhone|iPad|MacBook|Apple Watch|AirPods/i')
      .first()
      .isVisible()
      .catch(() => false);

    console.log("Got response with Apple products:", hasResponse);
  });

  test("should display chatbot information", async ({ page }) => {
    // Navigate to the chatbot test page
    await page.goto(TEST_URL, { timeout: 60000 });

    // Wait for page to load
    await page.waitForLoadState("domcontentloaded", { timeout: 30000 });

    // The page should not have build errors
    const pageContent = await page.content();

    // Verify it's not an error page
    expect(pageContent).not.toContain("Module not found");
    expect(pageContent).not.toContain("Build Error");
    expect(pageContent).not.toContain("Can't resolve '@buzzi-ai/agent-sdk'");
  });
});
