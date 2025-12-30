import { test, expect } from "@playwright/test";

test.describe("Shared Components - Route Protection", () => {
  test.describe("Company Admin Routes", () => {
    test("team page requires authentication", async ({ page }) => {
      await page.goto("/team");
      // Should redirect to login or show unauthorized
      await expect(page).toHaveURL(/login|unauthorized/);
    });

    test("knowledge page requires authentication", async ({ page }) => {
      await page.goto("/knowledge");
      await expect(page).toHaveURL(/login|unauthorized/);
    });

    test("conversations page requires authentication", async ({ page }) => {
      await page.goto("/conversations");
      await expect(page).toHaveURL(/login|unauthorized/);
    });

    test("chatbot pages require authentication", async ({ page }) => {
      await page.goto("/chatbots/test-id/test");
      await expect(page).toHaveURL(/login|unauthorized/);
    });
  });

  test.describe("Master Admin Routes", () => {
    test("admin panel requires authentication", async ({ page }) => {
      await page.goto("/admin");
      await expect(page).toHaveURL(/login|unauthorized/);
    });

    test("company team page requires authentication", async ({ page }) => {
      await page.goto("/admin/companies/test-id/team");
      await expect(page).toHaveURL(/login|unauthorized/);
    });

    test("company knowledge page requires authentication", async ({ page }) => {
      await page.goto("/admin/companies/test-id/knowledge");
      await expect(page).toHaveURL(/login|unauthorized/);
    });

    test("company conversations page requires authentication", async ({ page }) => {
      await page.goto("/admin/companies/test-id/conversations");
      await expect(page).toHaveURL(/login|unauthorized/);
    });
  });
});

test.describe("Shared Components - API Structure", () => {
  test("team API routes exist", async ({ request }) => {
    // Company admin route
    const companyResponse = await request.get("/api/company/team");
    expect([401, 403, 200]).toContain(companyResponse.status());

    // Master admin route
    const masterResponse = await request.get(
      "/api/master-admin/companies/test-id/team"
    );
    expect([401, 403, 404, 200]).toContain(masterResponse.status());
  });

  test("knowledge API routes exist", async ({ request }) => {
    const companyResponse = await request.get("/api/company/knowledge");
    expect([401, 403, 200]).toContain(companyResponse.status());

    const masterResponse = await request.get(
      "/api/master-admin/companies/test-id/knowledge"
    );
    expect([401, 403, 404, 200]).toContain(masterResponse.status());
  });

  test("conversations API routes exist", async ({ request }) => {
    const companyResponse = await request.get("/api/company/conversations");
    expect([401, 403, 200]).toContain(companyResponse.status());

    const masterResponse = await request.get(
      "/api/master-admin/companies/test-id/conversations"
    );
    expect([401, 403, 404, 200]).toContain(masterResponse.status());
  });

  test("team invite API routes exist", async ({ request }) => {
    const companyResponse = await request.post("/api/company/team/invite", {
      data: { email: "test@example.com", role: "chatapp.support_agent" },
    });
    expect([400, 401, 403, 200, 201]).toContain(companyResponse.status());

    const masterResponse = await request.post(
      "/api/master-admin/companies/test-id/team/invite",
      {
        data: { email: "test@example.com", role: "chatapp.support_agent" },
      }
    );
    expect([400, 401, 403, 404, 200, 201]).toContain(masterResponse.status());
  });
});
