import { describe, expect, it } from "vitest";

import {
  getDashboardUrl,
  getCompanyDashboardUrl,
  getRoleDisplayName,
  isMasterAdmin,
  isCompanyAdmin,
  isSupportAgent,
  hasCompanyPermission,
} from "./role-utils";

describe("Auth Guards", () => {
  describe("isMasterAdmin", () => {
    it("should return true for master_admin role", () => {
      expect(isMasterAdmin("chatapp.master_admin")).toBe(true);
    });

    it("should return false for user role", () => {
      expect(isMasterAdmin("chatapp.user")).toBe(false);
    });
  });

  describe("isCompanyAdmin", () => {
    it("should return true for company_admin permission", () => {
      expect(isCompanyAdmin("chatapp.company_admin")).toBe(true);
    });

    it("should return false for support_agent permission", () => {
      expect(isCompanyAdmin("chatapp.support_agent")).toBe(false);
    });
  });

  describe("isSupportAgent", () => {
    it("should return true for support_agent permission", () => {
      expect(isSupportAgent("chatapp.support_agent")).toBe(true);
    });

    it("should return false for company_admin permission", () => {
      expect(isSupportAgent("chatapp.company_admin")).toBe(false);
    });
  });

  describe("hasCompanyPermission", () => {
    it("should return true when user has exact permission", () => {
      expect(hasCompanyPermission("chatapp.company_admin", "chatapp.company_admin")).toBe(true);
      expect(hasCompanyPermission("chatapp.support_agent", "chatapp.support_agent")).toBe(true);
    });

    it("should return true when user has higher permission", () => {
      expect(hasCompanyPermission("chatapp.company_admin", "chatapp.support_agent")).toBe(true);
    });

    it("should return false when user has lower permission", () => {
      expect(hasCompanyPermission("chatapp.support_agent", "chatapp.company_admin")).toBe(false);
    });
  });

  describe("getDashboardUrl", () => {
    it("should return admin dashboard URL for master_admin", () => {
      expect(getDashboardUrl("chatapp.master_admin")).toBe("/admin/dashboard");
    });

    it("should return companies URL for regular user", () => {
      expect(getDashboardUrl("chatapp.user")).toBe("/companies");
    });
  });

  describe("getCompanyDashboardUrl", () => {
    it("should return dashboard for company_admin", () => {
      expect(getCompanyDashboardUrl("chatapp.company_admin")).toBe("/dashboard");
    });

    it("should return inbox for support_agent", () => {
      expect(getCompanyDashboardUrl("chatapp.support_agent")).toBe("/inbox");
    });
  });

  describe("getRoleDisplayName", () => {
    it("should return human-readable role names", () => {
      expect(getRoleDisplayName("chatapp.master_admin")).toBe("Master Admin");
      expect(getRoleDisplayName("chatapp.user")).toBe("User");
      expect(getRoleDisplayName("chatapp.company_admin")).toBe("Company Admin");
      expect(getRoleDisplayName("chatapp.support_agent")).toBe("Support Agent");
    });
  });
});
