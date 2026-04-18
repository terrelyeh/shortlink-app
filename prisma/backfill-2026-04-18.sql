-- Backfill for schema changes on 2026-04-18.
-- Run AFTER `pnpm db:push` (or `npx prisma db push`) has applied the schema.
--
-- Populates:
--   1. short_links.click_count  — live row count from clicks table
--   2. clicks.workspace_id      — denormalized from short_links
--
-- Safe to re-run (idempotent).

-- 1. Backfill short_links.click_count
UPDATE short_links sl
SET click_count = COALESCE(
  (SELECT COUNT(*) FROM clicks c WHERE c.short_link_id = sl.id),
  0
);

-- 2. Backfill clicks.workspace_id from short_links
UPDATE clicks c
SET workspace_id = sl.workspace_id
FROM short_links sl
WHERE c.short_link_id = sl.id
  AND c.workspace_id IS NULL;
