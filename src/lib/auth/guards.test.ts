import { describe, expect, it } from "vitest";

import { getDashboardUrl, getRoleDisplayName, hasRole } from "./role-utils";

describe("Auth Guards", () => {
  describe("hasRole", () => {
    it("should return true when user has exact role", () => {
      expect(hasRole("master_admin", "master_admin")).toBe(true);
      expect(hasRole("company_admin", "company_admin")).toBe(true);
      expect(hasRole("support_agent", "support_agent")).toBe(true);
    });

    it("should return true when user has higher role", () => {
      expect(hasRole("master_admin", "company_admin")).toBe(true);
      expect(hasRole("master_admin", "support_agent")).toBe(true);
      expect(hasRole("company_admin", "support_agent")).toBe(true);
    });

    it("should return false when user has lower role", () => {
      expect(hasRole("support_agent", "company_admin")).toBe(false);
      expect(hasRole("support_agent", "master_admin")).toBe(false);
      expect(hasRole("company_admin", "master_admin")).toBe(false);
    });
  });

  describe("getDashboardUrl", () => {
    it("should return correct dashboard URL for each role", () => {
      expect(getDashboardUrl("master_admin")).toBe("/admin/dashboard");
      expect(getDashboardUrl("company_admin")).toBe("/dashboard");
      expect(getDashboardUrl("support_agent")).toBe("/inbox");
    });
  });

  describe("getRoleDisplayName", () => {
    it("should return human-readable role names", () => {
      expect(getRoleDisplayName("master_admin")).toBe("Master Admin");
      expect(getRoleDisplayName("company_admin")).toBe("Company Admin");
      expect(getRoleDisplayName("support_agent")).toBe("Support Agent");
    });
  });
});
