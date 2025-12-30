"use client";

import { createContext, useContext } from "react";

import type { UseCompanyReturn } from "@/hooks/master-admin";

// Context to share company data with child pages
export interface CompanyContextType extends UseCompanyReturn {
  companyId: string;
}

export const CompanyContext = createContext<CompanyContextType | null>(null);

export function useCompanyContext() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompanyContext must be used within CompanyDetailsLayout");
  }
  return context;
}
