"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";

// Breadcrumb item type
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageContextType {
  breadcrumbs: BreadcrumbItem[];
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void;
}

const PageContext = createContext<PageContextType>({
  breadcrumbs: [],
  setBreadcrumbs: () => {},
});

export function PageProvider({ children }: { children: ReactNode }) {
  const [breadcrumbs, setBreadcrumbsState] = useState<BreadcrumbItem[]>([]);

  const setBreadcrumbs = useCallback((items: BreadcrumbItem[]) => {
    setBreadcrumbsState(items);
  }, []);

  return (
    <PageContext.Provider value={{ breadcrumbs, setBreadcrumbs }}>
      {children}
    </PageContext.Provider>
  );
}

export function usePageContext() {
  return useContext(PageContext);
}

// Legacy alias for backward compatibility
export function usePageTitle() {
  const { breadcrumbs, setBreadcrumbs } = usePageContext();
  return {
    pageTitle: breadcrumbs[0]?.label ?? "",
    setPageTitle: (title: string) => setBreadcrumbs([{ label: title }]),
    breadcrumbs,
    setBreadcrumbs,
  };
}

// Hook to set breadcrumbs on mount with deep comparison
export function useSetBreadcrumbs(breadcrumbs: BreadcrumbItem[]) {
  const { setBreadcrumbs } = usePageContext();
  const serializedRef = useRef<string>("");

  const serialized = JSON.stringify(breadcrumbs);

  useEffect(() => {
    if (serialized !== serializedRef.current) {
      serializedRef.current = serialized;
      setBreadcrumbs(JSON.parse(serialized));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, setBreadcrumbs]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);
}

// Legacy hook for simple page title (backward compatible)
export function useSetPageTitle(title: string) {
  const { setBreadcrumbs } = usePageContext();

  useEffect(() => {
    setBreadcrumbs([{ label: title }]);
    return () => setBreadcrumbs([]);
  }, [title, setBreadcrumbs]);
}
