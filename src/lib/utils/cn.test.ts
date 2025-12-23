import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn utility", () => {
  it("should merge class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("should handle conditional classes", () => {
    expect(cn("foo", true && "bar", false && "baz")).toBe("foo bar");
  });

  it("should merge tailwind classes correctly", () => {
    expect(cn("p-4", "p-8")).toBe("p-8");
  });

  it("should handle arrays", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("should handle objects", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });

  it("should handle undefined and null", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
  });
});
