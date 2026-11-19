import type { QueryClient } from "@tanstack/react-query";

/**
 * Bust every client cache that shows links after a bulk create (CSV
 * import, batch create). `refetchType: "all"` also refetches inactive
 * queries — otherwise, with `refetchOnMount: false`, the user returns to
 * /links and sees the pre-import list until they press 同步.
 * `tags` is included because the CSV importer auto-creates tags.
 */
export function invalidateAfterLinksCreated(qc: QueryClient) {
  for (const key of ["links", "campaigns-summary", "analytics-raw", "campaign-links", "utm-campaigns", "tags"]) {
    qc.invalidateQueries({ queryKey: [key], refetchType: "all" });
  }
}
