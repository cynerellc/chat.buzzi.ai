/**
 * Format Utilities Tests
 *
 * Tests for date, number, and string formatting utilities.
 */

import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatDateShort,
  formatTime,
  formatRelativeTime,
  formatRelativeDate,
  formatNumber,
  formatCompactNumber,
  formatCurrency,
  formatPercentage,
  formatBytes,
  truncate,
  capitalize,
  slugify,
  generateInitials,
} from "@/lib/utils/format";

// ============================================================================
// Date Formatting
// ============================================================================

describe("Date Formatting", () => {
  const testDate = new Date("2024-06-15T14:30:00Z");
  const testDateString = "2024-06-15T14:30:00Z";

  describe("formatDate", () => {
    it("should format Date object", () => {
      const result = formatDate(testDate);
      expect(result).toBeTruthy();
      expect(result).toContain("2024");
    });

    it("should format ISO date string", () => {
      const result = formatDate(testDateString);
      expect(result).toBeTruthy();
      expect(result).toContain("2024");
    });

    it("should return empty string for null", () => {
      expect(formatDate(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(formatDate(undefined)).toBe("");
    });

    it("should return empty string for invalid date", () => {
      expect(formatDate("invalid-date")).toBe("");
    });

    it("should use custom format", () => {
      const result = formatDate(testDate, "yyyy-MM-dd");
      expect(result).toBe("2024-06-15");
    });
  });

  describe("formatDateTime", () => {
    it("should include date and time", () => {
      const result = formatDateTime(testDate);
      expect(result).toBeTruthy();
      expect(result).toContain("2024");
    });

    it("should handle null", () => {
      expect(formatDateTime(null)).toBe("");
    });
  });

  describe("formatDateShort", () => {
    it("should format as short date", () => {
      const result = formatDateShort(testDate);
      expect(result).toBeTruthy();
      // Should contain month abbreviation
      expect(result).toMatch(/Jun|June/);
    });
  });

  describe("formatTime", () => {
    it("should format time only", () => {
      const result = formatTime(testDate);
      expect(result).toBeTruthy();
    });

    it("should handle null", () => {
      expect(formatTime(null)).toBe("");
    });
  });

  describe("formatRelativeTime", () => {
    it("should return relative time", () => {
      const recentDate = new Date(Date.now() - 60000); // 1 minute ago
      const result = formatRelativeTime(recentDate);
      expect(result).toContain("ago");
    });

    it("should handle null", () => {
      expect(formatRelativeTime(null)).toBe("");
    });

    it("should handle undefined", () => {
      expect(formatRelativeTime(undefined)).toBe("");
    });
  });

  describe("formatRelativeDate", () => {
    it("should return relative date", () => {
      const result = formatRelativeDate(new Date());
      expect(result).toBeTruthy();
    });

    it("should handle null", () => {
      expect(formatRelativeDate(null)).toBe("");
    });
  });
});

// ============================================================================
// Number Formatting
// ============================================================================

describe("Number Formatting", () => {
  describe("formatNumber", () => {
    it("should format integers with separators", () => {
      const result = formatNumber(1234567);
      expect(result).toContain(",");
    });

    it("should format decimals", () => {
      const result = formatNumber(1234.56);
      expect(result).toBeTruthy();
    });

    it("should return 0 for null", () => {
      expect(formatNumber(null)).toBe("0");
    });

    it("should return 0 for undefined", () => {
      expect(formatNumber(undefined)).toBe("0");
    });

    it("should handle zero", () => {
      expect(formatNumber(0)).toBe("0");
    });

    it("should handle negative numbers", () => {
      const result = formatNumber(-1234);
      expect(result).toContain("-");
    });
  });

  describe("formatCompactNumber", () => {
    it("should format thousands as K", () => {
      const result = formatCompactNumber(1500);
      expect(result.toLowerCase()).toContain("k");
    });

    it("should format millions as M", () => {
      const result = formatCompactNumber(1500000);
      expect(result.toLowerCase()).toContain("m");
    });

    it("should return 0 for null", () => {
      expect(formatCompactNumber(null)).toBe("0");
    });

    it("should handle small numbers", () => {
      const result = formatCompactNumber(50);
      expect(result).toBe("50");
    });
  });

  describe("formatCurrency", () => {
    it("should format USD by default", () => {
      const result = formatCurrency(1234.56);
      expect(result).toContain("$");
      expect(result).toContain("1,234.56");
    });

    it("should format with custom currency", () => {
      const result = formatCurrency(1000, "EUR");
      expect(result).toBeTruthy();
    });

    it("should return $0.00 for null", () => {
      expect(formatCurrency(null)).toBe("$0.00");
    });

    it("should return $0.00 for undefined", () => {
      expect(formatCurrency(undefined)).toBe("$0.00");
    });

    it("should handle zero", () => {
      expect(formatCurrency(0)).toBe("$0.00");
    });

    it("should handle negative amounts", () => {
      const result = formatCurrency(-50);
      expect(result).toContain("-");
    });
  });

  describe("formatPercentage", () => {
    it("should format decimal as percentage", () => {
      const result = formatPercentage(0.5);
      expect(result).toBe("50.0%");
    });

    it("should format with custom decimals", () => {
      const result = formatPercentage(0.123456, 2);
      expect(result).toBe("12.35%");
    });

    it("should return 0% for null", () => {
      expect(formatPercentage(null)).toBe("0%");
    });

    it("should handle 100%", () => {
      const result = formatPercentage(1);
      expect(result).toBe("100.0%");
    });

    it("should handle values over 100%", () => {
      const result = formatPercentage(1.5);
      expect(result).toBe("150.0%");
    });
  });

  describe("formatBytes", () => {
    it("should format bytes", () => {
      expect(formatBytes(500)).toBe("500 Bytes");
    });

    it("should format kilobytes", () => {
      const result = formatBytes(1024);
      expect(result).toContain("KB");
    });

    it("should format megabytes", () => {
      const result = formatBytes(1024 * 1024);
      expect(result).toContain("MB");
    });

    it("should format gigabytes", () => {
      const result = formatBytes(1024 * 1024 * 1024);
      expect(result).toContain("GB");
    });

    it("should return 0 Bytes for null", () => {
      expect(formatBytes(null)).toBe("0 Bytes");
    });

    it("should return 0 Bytes for zero", () => {
      expect(formatBytes(0)).toBe("0 Bytes");
    });

    it("should return 0 Bytes for undefined", () => {
      expect(formatBytes(undefined)).toBe("0 Bytes");
    });
  });
});

// ============================================================================
// String Utilities
// ============================================================================

describe("String Utilities", () => {
  describe("truncate", () => {
    it("should truncate long strings", () => {
      const result = truncate("This is a very long string", 10);
      expect(result).toBe("This is a ...");
      expect(result.length).toBe(13);
    });

    it("should not truncate short strings", () => {
      const result = truncate("Short", 10);
      expect(result).toBe("Short");
    });

    it("should handle exact length", () => {
      const result = truncate("12345", 5);
      expect(result).toBe("12345");
    });

    it("should handle empty string", () => {
      expect(truncate("", 10)).toBe("");
    });
  });

  describe("capitalize", () => {
    it("should capitalize first letter", () => {
      expect(capitalize("hello")).toBe("Hello");
    });

    it("should lowercase rest of string", () => {
      expect(capitalize("HELLO")).toBe("Hello");
    });

    it("should handle single character", () => {
      expect(capitalize("h")).toBe("H");
    });

    it("should handle empty string", () => {
      expect(capitalize("")).toBe("");
    });

    it("should handle mixed case", () => {
      expect(capitalize("hELLo WoRLD")).toBe("Hello world");
    });
  });

  describe("slugify", () => {
    it("should convert to lowercase", () => {
      expect(slugify("Hello World")).toBe("hello-world");
    });

    it("should replace spaces with hyphens", () => {
      expect(slugify("hello world")).toBe("hello-world");
    });

    it("should remove special characters", () => {
      expect(slugify("Hello! World?")).toBe("hello-world");
    });

    it("should collapse multiple hyphens", () => {
      expect(slugify("hello   world")).toBe("hello-world");
    });

    it("should handle empty string", () => {
      expect(slugify("")).toBe("");
    });

    it("should handle already slugified string", () => {
      expect(slugify("hello-world")).toBe("hello-world");
    });

    it("should handle numbers", () => {
      expect(slugify("Version 2.0")).toBe("version-20");
    });
  });

  describe("generateInitials", () => {
    it("should generate initials from full name", () => {
      expect(generateInitials("John Doe")).toBe("JD");
    });

    it("should handle single name", () => {
      const result = generateInitials("John");
      expect(result.length).toBe(2);
      expect(result).toBe("JO");
    });

    it("should handle multiple names", () => {
      expect(generateInitials("John Michael Doe")).toBe("JD");
    });

    it("should return ?? for null", () => {
      expect(generateInitials(null)).toBe("??");
    });

    it("should return ?? for undefined", () => {
      expect(generateInitials(undefined)).toBe("??");
    });

    it("should handle empty string", () => {
      expect(generateInitials("")).toBe("??");
    });

    it("should be uppercase", () => {
      const result = generateInitials("john doe");
      expect(result).toBe("JD");
    });

    it("should handle extra whitespace", () => {
      const result = generateInitials("  John   Doe  ");
      expect(result).toBe("JD");
    });
  });
});
