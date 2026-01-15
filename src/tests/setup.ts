/**
 * Vitest Test Setup
 *
 * Global test configuration and mocks.
 */

import "@testing-library/jest-dom/vitest";

// Mock console.error to keep test output clean
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  // Suppress known React warnings in tests
  const message = args[0];
  if (
    typeof message === "string" &&
    (message.includes("Warning:") || message.includes("React does not recognize"))
  ) {
    return;
  }
  originalConsoleError(...args);
};

// Global mocks
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock AudioContext
class MockAudioContext {
  state = "running";
  sampleRate = 48000;
  createMediaStreamSource() {
    return { connect: () => {} };
  }
  createScriptProcessor() {
    return { connect: () => {}, onaudioprocess: null };
  }
  createAnalyser() {
    return { connect: () => {}, fftSize: 256, getByteFrequencyData: () => {} };
  }
  close() {
    return Promise.resolve();
  }
}

global.AudioContext = MockAudioContext as unknown as typeof AudioContext;
