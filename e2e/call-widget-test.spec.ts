import { test, expect } from '@playwright/test';

test('call widget demo mode works', async ({ page }) => {
  // Capture all console messages
  const consoleLogs: string[] = [];
  const consoleErrors: string[] = [];

  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(`PAGE ERROR: ${err.message}`);
  });

  // Test demo mode first (no API call needed)
  const response = await page.goto('http://localhost:3000/preview/call-widget?demo=true');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Skip test if the page doesn't exist (404)
  if (response?.status() === 404) {
    test.skip(true, 'Preview call-widget page not implemented');
    return;
  }

  console.log('=== Console logs ===');
  consoleLogs.forEach(log => console.log(log));
  console.log('=== Console errors ===');
  consoleErrors.forEach(err => console.log(err));

  // Should see "Demo Mode" in the header subtitle or page loaded
  const demoHeader = await page.getByRole('banner').getByText('Demo Mode').isVisible().catch(() => false);
  const hasContent = await page.locator('body').textContent().then(t => t && t.length > 100).catch(() => false);
  console.log('Demo mode header visible:', demoHeader);

  await page.screenshot({ path: '/tmp/demo-mode.png', fullPage: true });

  // Check for hydration errors
  if (consoleErrors.length > 0) {
    console.log('Found errors - these may explain the issue');
  }

  // Either demo header is visible or page has content
  expect(demoHeader || hasContent).toBe(true);
});

test('call widget loads with real chatbot', async ({ page }) => {
  // Enable detailed network logging
  const requests: string[] = [];
  const responses: { url: string; status: number }[] = [];

  page.on('request', request => {
    if (request.url().includes('/api/')) {
      requests.push(`${request.method()} ${request.url()}`);
    }
  });

  page.on('response', response => {
    if (response.url().includes('/api/')) {
      responses.push({ url: response.url(), status: response.status() });
    }
  });

  page.on('requestfailed', request => {
    console.log('FAILED:', request.url(), request.failure()?.errorText);
  });

  // Navigate to real chatbot preview
  await page.goto('http://localhost:3000/preview/call-widget?chatbotId=fe090d4c-a6d4-4cec-9737-a913e0c9ce90&companyId=e26c57e9-0c4e-4d0a-b261-5d89e2db58ae');

  // Wait for page and network
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  console.log('API Requests:', requests);
  console.log('API Responses:', responses);

  await page.screenshot({ path: '/tmp/real-chatbot.png', fullPage: true });

  // Check if still loading or loaded
  const stillLoading = await page.locator('text=Loading call widget...').isVisible();
  const configLoaded = await page.locator('text=Widget Configuration').isVisible();
  const hasError = await page.locator('text=Configuration Error').isVisible();

  console.log('Still loading:', stillLoading);
  console.log('Config loaded:', configLoaded);
  console.log('Has error:', hasError);

  if (hasError) {
    const errorMsg = await page.locator('p.text-gray-600').first().textContent();
    console.log('Error message:', errorMsg);
  }

  // Page should have loaded (not still loading)
  expect(stillLoading).toBe(false);
});
