/**
 * useLocalStorage Hook Tests
 *
 * Tests for the localStorage persistence hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

describe("useLocalStorage", () => {
  let mockStorage: Record<string, string>;
  let mockLocalStorage: Storage;

  beforeEach(() => {
    mockStorage = {};
    mockLocalStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
      key: vi.fn((index: number) => Object.keys(mockStorage)[index] ?? null),
      get length() {
        return Object.keys(mockStorage).length;
      },
    };

    Object.defineProperty(window, "localStorage", {
      value: mockLocalStorage,
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Initial Value
  // ============================================================================

  describe("initial value", () => {
    it("should return initial value when key does not exist", () => {
      const { result } = renderHook(() =>
        useLocalStorage("nonexistent", "default")
      );

      expect(result.current[0]).toBe("default");
    });

    it("should return stored value when key exists", () => {
      mockStorage["existing"] = JSON.stringify("stored-value");

      const { result } = renderHook(() =>
        useLocalStorage("existing", "default")
      );

      expect(result.current[0]).toBe("stored-value");
    });

    it("should handle complex objects", () => {
      const storedObject = { name: "Test", count: 42 };
      mockStorage["object-key"] = JSON.stringify(storedObject);

      const { result } = renderHook(() =>
        useLocalStorage("object-key", { name: "", count: 0 })
      );

      expect(result.current[0]).toEqual(storedObject);
    });

    it("should handle arrays", () => {
      const storedArray = [1, 2, 3, 4, 5];
      mockStorage["array-key"] = JSON.stringify(storedArray);

      const { result } = renderHook(() => useLocalStorage("array-key", []));

      expect(result.current[0]).toEqual(storedArray);
    });

    it("should return initial value on parse error", () => {
      mockStorage["invalid"] = "not-valid-json{";
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { result } = renderHook(() =>
        useLocalStorage("invalid", "default")
      );

      expect(result.current[0]).toBe("default");
      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // Setting Values
  // ============================================================================

  describe("setValue", () => {
    it("should update state and localStorage", () => {
      const { result } = renderHook(() =>
        useLocalStorage("test-key", "initial")
      );

      act(() => {
        result.current[1]("updated");
      });

      expect(result.current[0]).toBe("updated");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "test-key",
        JSON.stringify("updated")
      );
    });

    it("should support functional updates", () => {
      const { result } = renderHook(() => useLocalStorage("counter", 0));

      act(() => {
        result.current[1]((prev) => prev + 1);
      });

      expect(result.current[0]).toBe(1);

      act(() => {
        result.current[1]((prev) => prev + 10);
      });

      expect(result.current[0]).toBe(11);
    });

    it("should handle complex objects", () => {
      const { result } = renderHook(() =>
        useLocalStorage("user", { name: "", age: 0 })
      );

      act(() => {
        result.current[1]({ name: "John", age: 30 });
      });

      expect(result.current[0]).toEqual({ name: "John", age: 30 });
    });

    it("should handle arrays", () => {
      const { result } = renderHook(() => useLocalStorage("items", []));

      act(() => {
        result.current[1]([1, 2, 3]);
      });

      expect(result.current[0]).toEqual([1, 2, 3]);

      act(() => {
        result.current[1]((prev: number[]) => [...prev, 4]);
      });

      expect(result.current[0]).toEqual([1, 2, 3, 4]);
    });

    it("should handle boolean values", () => {
      const { result } = renderHook(() => useLocalStorage("flag", false));

      act(() => {
        result.current[1](true);
      });

      expect(result.current[0]).toBe(true);

      act(() => {
        result.current[1]((prev) => !prev);
      });

      expect(result.current[0]).toBe(false);
    });

    it("should handle null values", () => {
      const { result } = renderHook(() =>
        useLocalStorage<string | null>("nullable", null)
      );

      act(() => {
        result.current[1]("value");
      });

      expect(result.current[0]).toBe("value");

      act(() => {
        result.current[1](null);
      });

      expect(result.current[0]).toBe(null);
    });
  });

  // ============================================================================
  // Removing Values
  // ============================================================================

  describe("removeValue", () => {
    it("should reset to initial value and remove from localStorage", () => {
      mockStorage["test-key"] = JSON.stringify("stored");

      const { result } = renderHook(() =>
        useLocalStorage("test-key", "initial")
      );

      expect(result.current[0]).toBe("stored");

      act(() => {
        result.current[2]();
      });

      expect(result.current[0]).toBe("initial");
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("test-key");
    });

    it("should work with complex initial values", () => {
      const initialValue = { name: "Default", items: [] };
      mockStorage["object-key"] = JSON.stringify({ name: "Stored", items: [1] });

      const { result } = renderHook(() =>
        useLocalStorage("object-key", initialValue)
      );

      expect(result.current[0]).toEqual({ name: "Stored", items: [1] });

      act(() => {
        result.current[2]();
      });

      expect(result.current[0]).toEqual(initialValue);
    });
  });

  // ============================================================================
  // Key Changes
  // ============================================================================

  describe("key changes", () => {
    it("should read new key value when key changes", () => {
      mockStorage["key1"] = JSON.stringify("value1");
      mockStorage["key2"] = JSON.stringify("value2");

      const { result, rerender } = renderHook(
        ({ key }) => useLocalStorage(key, "default"),
        { initialProps: { key: "key1" } }
      );

      expect(result.current[0]).toBe("value1");

      rerender({ key: "key2" });

      expect(result.current[0]).toBe("value2");
    });

    it("should use initial value for non-existent new key", () => {
      mockStorage["key1"] = JSON.stringify("value1");

      const { result, rerender } = renderHook(
        ({ key }) => useLocalStorage(key, "default"),
        { initialProps: { key: "key1" } }
      );

      expect(result.current[0]).toBe("value1");

      rerender({ key: "nonexistent" });

      expect(result.current[0]).toBe("default");
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe("error handling", () => {
    it("should handle getItem errors gracefully", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockLocalStorage.getItem = vi.fn(() => {
        throw new Error("Storage error");
      });

      const { result } = renderHook(() =>
        useLocalStorage("error-key", "default")
      );

      expect(result.current[0]).toBe("default");
      consoleSpy.mockRestore();
    });

    it("should handle setItem errors gracefully", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockLocalStorage.setItem = vi.fn(() => {
        throw new Error("Quota exceeded");
      });

      const { result } = renderHook(() => useLocalStorage("test", "initial"));

      // Should not throw
      act(() => {
        result.current[1]("new value");
      });

      consoleSpy.mockRestore();
    });

    it("should handle removeItem errors gracefully", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockLocalStorage.removeItem = vi.fn(() => {
        throw new Error("Remove error");
      });

      const { result } = renderHook(() => useLocalStorage("test", "initial"));

      // Should not throw
      act(() => {
        result.current[2]();
      });

      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // Type Safety
  // ============================================================================

  describe("type safety", () => {
    it("should maintain type with numbers", () => {
      const { result } = renderHook(() => useLocalStorage("number", 0));

      act(() => {
        result.current[1](42);
      });

      expect(typeof result.current[0]).toBe("number");
      expect(result.current[0]).toBe(42);
    });

    it("should maintain type with objects", () => {
      interface User {
        id: number;
        name: string;
      }

      const { result } = renderHook(() =>
        useLocalStorage<User>("user", { id: 0, name: "" })
      );

      act(() => {
        result.current[1]({ id: 1, name: "Test" });
      });

      expect(result.current[0].id).toBe(1);
      expect(result.current[0].name).toBe("Test");
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("edge cases", () => {
    it("should handle empty string value", () => {
      const { result } = renderHook(() => useLocalStorage("empty", "default"));

      act(() => {
        result.current[1]("");
      });

      expect(result.current[0]).toBe("");
    });

    it("should handle zero value", () => {
      const { result } = renderHook(() => useLocalStorage("zero", 100));

      act(() => {
        result.current[1](0);
      });

      expect(result.current[0]).toBe(0);
    });

    it("should handle undefined in array", () => {
      const { result } = renderHook(() =>
        useLocalStorage<(number | undefined)[]>("array", [])
      );

      act(() => {
        result.current[1]([1, undefined, 3]);
      });

      // JSON.stringify converts undefined to null in arrays
      expect(result.current[0]).toEqual([1, null, 3]);
    });

    it("should handle special characters in key", () => {
      const { result } = renderHook(() =>
        useLocalStorage("key:with:colons", "value")
      );

      act(() => {
        result.current[1]("updated");
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "key:with:colons",
        JSON.stringify("updated")
      );
    });
  });
});
