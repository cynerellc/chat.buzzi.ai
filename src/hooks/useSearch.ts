"use client";

import { useCallback, useState } from "react";

import { useDebounce } from "./useDebounce";

export interface UseSearchOptions {
  debounceMs?: number;
  minLength?: number;
}

export interface UseSearchReturn {
  query: string;
  debouncedQuery: string;
  setQuery: (query: string) => void;
  clearQuery: () => void;
  isSearching: boolean;
  setIsSearching: (searching: boolean) => void;
  hasQuery: boolean;
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { debounceMs = 300, minLength = 0 } = options;

  const [query, setQueryState] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const debouncedQuery = useDebounce(query, debounceMs);

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
  }, []);

  const clearQuery = useCallback(() => {
    setQueryState("");
  }, []);

  const hasQuery = debouncedQuery.length >= minLength && debouncedQuery.trim().length > 0;

  return {
    query,
    debouncedQuery,
    setQuery,
    clearQuery,
    isSearching,
    setIsSearching,
    hasQuery,
  };
}
