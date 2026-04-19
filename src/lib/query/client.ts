"use client";

import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient defaults.
 *
 * - staleTime: 5 min — within this window, cached data is served immediately
 *   without background refetch. Long enough that tab-switching within a work
 *   session feels instant; short enough that a user returning after coffee
 *   gets fresh data.
 * - gcTime (formerly cacheTime): 30 min — how long unused queries stay in
 *   memory before garbage collection. Safe to unmount a page and come back
 *   within half an hour with zero network.
 * - refetchOnWindowFocus / refetchOnMount: false by default — user controls
 *   refresh via the Sync button or mutations. Auto-refetch was the whole
 *   problem being solved.
 * - retry: 1 — one retry on failure, then surface the error. Default 3
 *   retries delays the UI too long when an endpoint is actually broken.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });
}
