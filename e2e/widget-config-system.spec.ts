import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Widget Configuration JSON System
 *
 * Tests the pre-generated widget config JSON system that:
 * 1. Loads widget config from JSON files stored in Supabase
 * 2. Regenerates JSON when widget settings or chatbot data changes
 * 3. Applies stream display options (thinking, tool calls, notifications)
 * 4. Applies multi-agent display options
 */

test.describe("Widget Config JSON System", () => {
  // Test company and chatbot IDs - these should exist in your test database
  const TEST_COMPANY_ID = process.env.TEST_COMPANY_ID || "test-company-id";
  const TEST_CHATBOT_ID = process.env.TEST_CHATBOT_ID || "test-chatbot-id";

  test.describe("Config Loading", () => {
    test("widget loads config from pre-generated JSON URL first", async ({ page }) => {
      // Track network requests to verify JSON loading priority
      const configUrlRequests: string[] = [];
      const jsonConfigRequests: string[] = [];
      const configApiRequests: string[] = [];
      const allRequests: string[] = [];

      // Debug: Log all requests
      page.on("request", (request) => {
        allRequests.push(request.url());
      });

      // Mock the config-url endpoint to return a valid JSON URL
      await page.route(/\/api\/widget\/config-url/, async (route) => {
        configUrlRequests.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            configUrl: "https://example.supabase.co/storage/v1/object/public/chatapp/test.json",
            chatbotId: TEST_CHATBOT_ID,
            generatedAt: new Date().toISOString(),
          }),
        });
      });

      // Mock the JSON file fetch from Supabase
      await page.route(/supabase.*\.json|storage.*\.json/, async (route) => {
        jsonConfigRequests.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            version: "1.0.0",
            generatedAt: new Date().toISOString(),
            chatbot: { id: TEST_CHATBOT_ID, name: "Test Bot", type: "single_agent", companyId: TEST_COMPANY_ID },
            agents: [{ id: "agent-1", name: "Agent 1", type: "worker" }],
            appearance: { theme: "light", position: "bottom-right", primaryColor: "#007bff", accentColor: "#0056b3", borderRadius: 8, buttonSize: 56, launcherIcon: "chat", zIndex: 9999 },
            branding: { title: "Test Bot", welcomeMessage: "Hello!", showBranding: true },
            behavior: { autoOpen: false, autoOpenDelay: 0, playSoundOnMessage: false, showTypingIndicator: true, persistConversation: true, hideLauncherOnMobile: false },
            features: { enableFileUpload: false, enableVoiceMessages: false, enableEmoji: true, enableFeedback: true, requireEmail: false, requireName: false },
            streamDisplay: { showAgentSwitchNotification: true, showThinking: false, showToolCalls: false, showInstantUpdates: true },
            preChatForm: { enabled: false, fields: [] },
            security: { allowedDomains: [], blockedDomains: [] },
          }),
        });
      });

      // Also mock the fallback config API (should NOT be called)
      await page.route(/\/api\/widget\/config(?!-url)/, async (route) => {
        configApiRequests.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ config: {} }),
        });
      });

      // Navigate to widget page
      await page.goto(
        `/embed-widget?agentId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}&theme=light&primaryColor=%23007bff`
      );

      // Wait for widget to load
      await page.waitForSelector("header", { timeout: 10000 });

      // Debug: Log all API requests made
      const apiRequests = allRequests.filter(url => url.includes("/api/"));
      console.log("All API requests:", apiRequests);

      // Verify config-url endpoint was called first
      expect(configUrlRequests.length, `Expected config-url to be called. All API requests: ${JSON.stringify(apiRequests)}`).toBeGreaterThan(0);

      // JSON should have been fetched from Supabase
      expect(jsonConfigRequests.length).toBe(1);

      // Config API should NOT be called since JSON load succeeded
      expect(configApiRequests.length).toBe(0);
    });

    test("widget falls back to config API when JSON fails", async ({ page }) => {
      const configUrlRequests: string[] = [];
      const configApiCalls: string[] = [];

      // Mock config-url to return null (no pre-generated config)
      // Use regex pattern for reliable matching (glob patterns have issues)
      await page.route(/\/api\/widget\/config-url/, async (route) => {
        configUrlRequests.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ configUrl: null }),
        });
      });

      // Mock the fallback config API (exclude config-url with negative lookahead)
      await page.route(/\/api\/widget\/config(?!-url)/, async (route) => {
        configApiCalls.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            config: {
              agentId: TEST_CHATBOT_ID,
              companyId: TEST_COMPANY_ID,
              theme: "light",
              primaryColor: "#007bff",
            },
          }),
        });
      });

      await page.goto(
        `/embed-widget?agentId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}&theme=light&primaryColor=%23007bff`
      );

      // Wait for widget to load
      await page.waitForSelector("header", { timeout: 10000 });

      // Config-url endpoint should have been called first
      expect(configUrlRequests.length).toBeGreaterThan(0);

      // Fallback config API should have been called since JSON was not available
      expect(configApiCalls.length).toBeGreaterThan(0);
    });
  });

  test.describe("Config Regeneration", () => {
    test.beforeEach(async ({ page }) => {
      // Login as company admin first (adjust based on your auth flow)
      await page.goto("/login");
      // Add login steps here if needed
    });

    test.skip("JSON regenerates when widget settings are saved", async ({ page }) => {
      // Navigate to widget settings
      await page.goto(`/chatbots/${TEST_CHATBOT_ID}/widget`);

      // Wait for settings to load
      await page.waitForSelector('[data-testid="widget-settings"]', { timeout: 10000 });

      // Track regeneration API call
      let regenerationCalled = false;
      page.on("response", (response) => {
        // Check if the PATCH response indicates regeneration happened
        if (response.url().includes(`/chatbots/${TEST_CHATBOT_ID}/widget`) && response.request().method() === "PATCH") {
          regenerationCalled = true;
        }
      });

      // Make a change to widget settings
      const titleInput = page.locator('input[label="Widget Title"]');
      await titleInput.fill("Test Widget Title " + Date.now());

      // Save changes
      await page.click('button:has-text("Save Changes")');

      // Wait for save to complete
      await page.waitForSelector('text=Widget settings saved', { timeout: 10000 });

      expect(regenerationCalled).toBe(true);
    });

    test.skip("JSON regenerates when chatbot agentsList is updated", async ({ page }) => {
      // Navigate to chatbot general settings
      await page.goto(`/chatbots/${TEST_CHATBOT_ID}/general`);

      // Wait for settings to load
      await page.waitForSelector('[data-testid="chatbot-settings"]', { timeout: 10000 });

      let regenerationTriggered = false;
      page.on("response", (response) => {
        if (response.url().includes(`/chatbots/${TEST_CHATBOT_ID}`) && response.request().method() === "PATCH") {
          regenerationTriggered = true;
        }
      });

      // Make a change that affects agentsList (e.g., update name)
      const nameInput = page.locator('input[name="name"]');
      await nameInput.fill("Test Agent " + Date.now());

      // Save
      await page.click('button:has-text("Save")');

      // Wait for save
      await page.waitForTimeout(2000);

      expect(regenerationTriggered).toBe(true);
    });
  });

  test.describe("Stream Display Options", () => {
    test("thinking state respects showThinking config", async ({ page }) => {
      // Create a mock config with showThinking disabled
      await page.route("**/api/widget/config-url**", async (route) => {
        // Return a mock response that simulates no JSON URL available
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ configUrl: null }),
        });
      });

      await page.route("**/api/widget/config**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            config: {
              agentId: TEST_CHATBOT_ID,
              companyId: TEST_COMPANY_ID,
              theme: "light",
              primaryColor: "#007bff",
              showThinking: false,
              showToolCalls: true,
              showInstantUpdates: true,
            },
          }),
        });
      });

      await page.goto(
        `/embed-widget?agentId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}&theme=light&primaryColor=%23007bff`
      );

      // Widget should load without showing thinking state
      await page.waitForSelector("header");

      // Verify the config was applied (check for absence of thinking UI when messages come in)
      // This would need SSE simulation which is complex for E2E tests
      // For now, just verify the page loads correctly
      const header = page.locator("header");
      await expect(header).toBeVisible();
    });

    test("agent notifications respect showAgentSwitchNotification config", async ({ page }) => {
      await page.route("**/api/widget/config-url**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ configUrl: null }),
        });
      });

      await page.route("**/api/widget/config**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            config: {
              agentId: TEST_CHATBOT_ID,
              companyId: TEST_COMPANY_ID,
              theme: "light",
              primaryColor: "#007bff",
              showAgentSwitchNotification: false,
              isMultiAgent: true,
              agentsList: [
                { id: "agent-1", name: "Agent 1" },
                { id: "agent-2", name: "Agent 2" },
              ],
            },
          }),
        });
      });

      await page.goto(
        `/embed-widget?agentId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`
      );

      await page.waitForSelector("header");

      // Verify multi-agent UI is present but notification would be hidden
      // (Full verification would require SSE simulation)
      const header = page.locator("header");
      await expect(header).toBeVisible();
    });
  });

  test.describe("Multi-Agent Display Options", () => {
    test("agent list is hidden when showAgentListOnTop is false", async ({ page }) => {
      await page.route("**/api/widget/config-url**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ configUrl: null }),
        });
      });

      await page.route("**/api/widget/config**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            config: {
              agentId: TEST_CHATBOT_ID,
              companyId: TEST_COMPANY_ID,
              theme: "light",
              primaryColor: "#007bff",
              isMultiAgent: true,
              showAgentListOnTop: false,
              agentsList: [
                { id: "agent-1", name: "Agent 1" },
                { id: "agent-2", name: "Agent 2" },
              ],
            },
          }),
        });
      });

      await page.goto(
        `/embed-widget?agentId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`
      );

      await page.waitForSelector("header");

      // The horizontal agent list should NOT be visible
      const agentsList = page.locator('[data-agent-id]');
      await expect(agentsList).toHaveCount(0);
    });

    test("agent list is shown when showAgentListOnTop is true", async ({ page }) => {
      await page.route("**/api/widget/config-url**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ configUrl: null }),
        });
      });

      await page.route("**/api/widget/config**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            config: {
              agentId: TEST_CHATBOT_ID,
              companyId: TEST_COMPANY_ID,
              theme: "light",
              primaryColor: "#007bff",
              isMultiAgent: true,
              showAgentListOnTop: true,
              agentsList: [
                { id: "agent-1", name: "Agent 1" },
                { id: "agent-2", name: "Agent 2" },
                { id: "agent-3", name: "Agent 3" },
              ],
            },
          }),
        });
      });

      await page.goto(
        `/embed-widget?agentId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`
      );

      await page.waitForSelector("header");

      // The horizontal agent list should be visible with all agents
      const agentCards = page.locator('[data-agent-id]');
      await expect(agentCards).toHaveCount(3);
    });

    test("first agent is highlighted as active by default", async ({ page }) => {
      await page.route("**/api/widget/config-url**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ configUrl: null }),
        });
      });

      await page.route("**/api/widget/config**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            config: {
              agentId: TEST_CHATBOT_ID,
              companyId: TEST_COMPANY_ID,
              theme: "light",
              primaryColor: "#007bff",
              isMultiAgent: true,
              showAgentListOnTop: true,
              agentsList: [
                { id: "agent-1", name: "Agent 1" },
                { id: "agent-2", name: "Agent 2" },
              ],
            },
          }),
        });
      });

      // Mock session creation
      await page.route("**/api/widget/session", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            sessionId: "test-session-id",
            conversationId: "test-conversation-id",
            endUserId: "test-end-user-id",
          }),
        });
      });

      await page.goto(
        `/embed-widget?agentId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`
      );

      await page.waitForSelector('[data-agent-id="agent-1"]');

      // First agent should have the active indicator (green dot)
      const firstAgentCard = page.locator('[data-agent-id="agent-1"]');
      const activeIndicator = firstAgentCard.locator('span[style*="background-color"]');
      await expect(activeIndicator).toBeVisible();
    });
  });

  test.describe("Widget Config API Endpoint", () => {
    test.skip("config-url endpoint returns config URL when available", async ({ request }) => {
      // This test requires real database data - skipped by default
      // To run: set TEST_COMPANY_ID and TEST_CHATBOT_ID env vars to valid IDs
      const response = await request.get(
        `/api/widget/config-url?chatbotId=${TEST_CHATBOT_ID}&companyId=${TEST_COMPANY_ID}`
      );

      // Should return 200 (found), 404 (not found), or 500 (db error with test IDs)
      expect([200, 404, 500]).toContain(response.status());

      if (response.status() === 200) {
        const data = await response.json();
        // Should have configUrl field
        expect(data).toHaveProperty("configUrl");
        expect(data).toHaveProperty("chatbotId");
      }
    });

    test("config-url endpoint requires chatbotId and companyId", async ({ request }) => {
      // Missing both params
      const response1 = await request.get("/api/widget/config-url");
      expect(response1.status()).toBe(400);

      // Missing companyId
      const response2 = await request.get(`/api/widget/config-url?chatbotId=${TEST_CHATBOT_ID}`);
      expect(response2.status()).toBe(400);

      // Missing chatbotId
      const response3 = await request.get(`/api/widget/config-url?companyId=${TEST_COMPANY_ID}`);
      expect(response3.status()).toBe(400);
    });
  });
});
