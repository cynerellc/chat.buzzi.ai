/**
 * useDebounce Hook Tests
 *
 * Tests for the debounce hook that delays value updates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDebounce, useDebouncedCallback } from "@/hooks/useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("useDebounce hook", () => {
    it("should return initial value immediately", () => {
      const { result } = renderHook(() => useDebounce("initial", 300));
      expect(result.current).toBe("initial");
    });

    it("should debounce value changes", () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: "initial" } }
      );

      expect(result.current).toBe("initial");

      // Update value
      rerender({ value: "updated" });

      // Should still be initial (debounce hasn't fired)
      expect(result.current).toBe("initial");

      // Fast forward time
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Now should be updated
      expect(result.current).toBe("updated");
    });

    it("should reset timer on rapid changes", () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: "v1" } }
      );

      // Rapid updates
      rerender({ value: "v2" });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      rerender({ value: "v3" });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      rerender({ value: "v4" });

      // Should still be v1
      expect(result.current).toBe("v1");

      // Fast forward full delay
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should be v4 (latest value)
      expect(result.current).toBe("v4");
    });

    it("should use custom delay", () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        { initialProps: { value: "initial" } }
      );

      rerender({ value: "updated" });

      // After 300ms, should still be initial
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current).toBe("initial");

      // After additional 200ms (total 500ms), should be updated
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current).toBe("updated");
    });

    it("should work with different types", () => {
      // Number
      const { result: numResult, rerender: numRerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: 0 } }
      );
      numRerender({ value: 42 });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(numResult.current).toBe(42);

      // Object
      const { result: objResult, rerender: objRerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: { name: "initial" } } }
      );
      objRerender({ value: { name: "updated" } });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(objResult.current).toEqual({ name: "updated" });

      // Array
      const { result: arrResult, rerender: arrRerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: [1, 2, 3] } }
      );
      arrRerender({ value: [4, 5, 6] });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(arrResult.current).toEqual([4, 5, 6]);
    });

    it("should use default delay of 300ms", () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value),
        { initialProps: { value: "initial" } }
      );

      rerender({ value: "updated" });

      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(result.current).toBe("initial");

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current).toBe("updated");
    });

    it("should cleanup timeout on unmount", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { unmount, rerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: "initial" } }
      );

      rerender({ value: "updated" });
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe("useDebouncedCallback hook", () => {
    it("should debounce callback execution", () => {
      const callback = vi.fn();

      const { result } = renderHook(() => useDebouncedCallback(callback, 300));

      // Call debounced function
      act(() => {
        result.current();
      });

      // Callback should not have been called yet
      expect(callback).not.toHaveBeenCalled();

      // Fast forward
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Now callback should have been called
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should pass arguments to callback", () => {
      const callback = vi.fn();

      const { result } = renderHook(() =>
        useDebouncedCallback(callback, 300)
      );

      act(() => {
        result.current("arg1", "arg2");
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(callback).toHaveBeenCalledWith("arg1", "arg2");
    });

    it("should cancel previous calls on rapid invocations", () => {
      const callback = vi.fn();

      const { result } = renderHook(() => useDebouncedCallback(callback, 300));

      // Rapid calls
      act(() => {
        result.current("call1");
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => {
        result.current("call2");
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => {
        result.current("call3");
      });

      // Fast forward full delay
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should only be called once with last argument
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith("call3");
    });

    it("should cleanup on unmount", () => {
      const callback = vi.fn();
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { result, unmount } = renderHook(() =>
        useDebouncedCallback(callback, 300)
      );

      act(() => {
        result.current();
      });

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });
});
