import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should display login page", async ({ page }) => {
    await page.goto("/login");

    // Check for login form elements
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("should show validation errors for empty form", async ({ page }) => {
    await page.goto("/login");

    // Submit empty form
    await page.getByRole("button", { name: /sign in/i }).click();

    // Check for validation errors
    await expect(page.getByText(/email is required|please enter/i)).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill in invalid credentials
    await page.getByLabel(/email/i).fill("invalid@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Check for error message
    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to registration page", async ({ page }) => {
    await page.goto("/login");

    // Click sign up link
    await page.getByRole("link", { name: /sign up|register|create account/i }).click();

    // Verify navigation
    await expect(page).toHaveURL(/register|signup/);
  });
});

test.describe("Protected Routes", () => {
  test("should redirect to login when accessing dashboard unauthenticated", async ({ page }) => {
    await page.goto("/dashboard");

    // Should be redirected to login
    await expect(page).toHaveURL(/login/);
  });

  test("should redirect to login when accessing admin panel unauthenticated", async ({ page }) => {
    await page.goto("/admin");

    // Should be redirected to login
    await expect(page).toHaveURL(/login/);
  });
});
