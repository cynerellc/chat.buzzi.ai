/**
 * Fetch Mocks
 *
 * Mock implementations for fetch and API calls.
 */

import { vi } from "vitest";

// ============================================================================
// Types
// ============================================================================

interface MockResponseOptions {
  status?: number;
  headers?: Record<string, string>;
  ok?: boolean;
}

interface MockResponse {
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  ok: boolean;
  status: number;
  headers: Headers;
}

type FetchHandler = (url: string, options?: RequestInit) => Promise<MockResponse>;

// ============================================================================
// Mock Fetch
// ============================================================================

const handlers: Map<string, FetchHandler> = new Map();

function createMockResponse(data: unknown, options: MockResponseOptions = {}): MockResponse {
  const { status = 200, headers = {}, ok = status >= 200 && status < 300 } = options;

  return {
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(typeof data === "string" ? data : JSON.stringify(data)),
    ok,
    status,
    headers: new Headers(headers),
  };
}

export const mockFetch = vi.fn(async (url: string, options?: RequestInit): Promise<MockResponse> => {
  // Check for registered handlers
  for (const [pattern, handler] of handlers) {
    if (url.includes(pattern)) {
      return handler(url, options);
    }
  }

  // Default response
  return createMockResponse({ error: "Not found" }, { status: 404, ok: false });
});

// ============================================================================
// Handler Registration
// ============================================================================

export function registerFetchHandler(urlPattern: string, handler: FetchHandler) {
  handlers.set(urlPattern, handler);
}

export function registerJsonResponse(urlPattern: string, data: unknown, options?: MockResponseOptions) {
  handlers.set(urlPattern, () => Promise.resolve(createMockResponse(data, options)));
}

export function clearFetchHandlers() {
  handlers.clear();
}

// ============================================================================
// Setup
// ============================================================================

export function setupFetchMock() {
  global.fetch = mockFetch as unknown as typeof fetch;
}

export function resetFetchMock() {
  mockFetch.mockClear();
  clearFetchHandlers();
}

// ============================================================================
// Common API Mocks
// ============================================================================

export function mockApiSuccess(urlPattern: string, data: unknown) {
  registerJsonResponse(urlPattern, data, { status: 200 });
}

export function mockApiError(urlPattern: string, error: string, status = 400) {
  registerJsonResponse(urlPattern, { error }, { status, ok: false });
}

export function mockApiNotFound(urlPattern: string) {
  registerJsonResponse(urlPattern, { error: "Not found" }, { status: 404, ok: false });
}

export function mockApiUnauthorized(urlPattern: string) {
  registerJsonResponse(urlPattern, { error: "Unauthorized" }, { status: 401, ok: false });
}
