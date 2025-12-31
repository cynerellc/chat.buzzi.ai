"use client";

import { useSetPageTitle } from "@/contexts/page-context";

interface PageTitleSetterProps {
  title: string;
}

/**
 * C5: Thin client wrapper for setting page title in Server Components
 */
export function PageTitleSetter({ title }: PageTitleSetterProps) {
  useSetPageTitle(title);
  return null;
}
