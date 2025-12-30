"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface PageContextType {
  pageTitle: string;
  setPageTitle: (title: string) => void;
}

const PageContext = createContext<PageContextType>({
  pageTitle: "",
  setPageTitle: () => {},
});

export function PageProvider({ children }: { children: ReactNode }) {
  const [pageTitle, setPageTitleState] = useState("");

  const setPageTitle = useCallback((title: string) => {
    setPageTitleState(title);
  }, []);

  return (
    <PageContext.Provider value={{ pageTitle, setPageTitle }}>
      {children}
    </PageContext.Provider>
  );
}

export function usePageTitle() {
  return useContext(PageContext);
}

// Hook to set page title on mount
export function useSetPageTitle(title: string) {
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle(title);
    return () => setPageTitle("");
  }, [title, setPageTitle]);
}
