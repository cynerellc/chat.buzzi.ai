"use client";

import { useCallback, useMemo, useState } from "react";

export interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  totalItems?: number;
}

export interface UsePaginationReturn extends PaginationState {
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setTotalItems: (total: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  canNextPage: boolean;
  canPrevPage: boolean;
  pageRange: number[];
  startIndex: number;
  endIndex: number;
}

export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { initialPage = 1, initialPageSize = 10, totalItems: initialTotal = 0 } = options;

  const [page, setPageState] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [totalItems, setTotalItemsState] = useState(initialTotal);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / pageSize)),
    [totalItems, pageSize]
  );

  const setPage = useCallback(
    (newPage: number) => {
      const clampedPage = Math.min(Math.max(1, newPage), totalPages);
      setPageState(clampedPage);
    },
    [totalPages]
  );

  const setPageSize = useCallback((newPageSize: number) => {
    setPageSizeState(Math.max(1, newPageSize));
    setPageState(1); // Reset to first page when page size changes
  }, []);

  const setTotalItems = useCallback((total: number) => {
    setTotalItemsState(Math.max(0, total));
  }, []);

  const nextPage = useCallback(() => {
    setPage(page + 1);
  }, [page, setPage]);

  const prevPage = useCallback(() => {
    setPage(page - 1);
  }, [page, setPage]);

  const firstPage = useCallback(() => {
    setPage(1);
  }, [setPage]);

  const lastPage = useCallback(() => {
    setPage(totalPages);
  }, [setPage, totalPages]);

  const canNextPage = page < totalPages;
  const canPrevPage = page > 1;

  // Calculate visible page range (show 5 pages max)
  const pageRange = useMemo(() => {
    const range: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);

    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }, [page, totalPages]);

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize - 1, totalItems - 1);

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    setPage,
    setPageSize,
    setTotalItems,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    canNextPage,
    canPrevPage,
    pageRange,
    startIndex,
    endIndex,
  };
}
