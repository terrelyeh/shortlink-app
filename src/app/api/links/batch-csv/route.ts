/**
 * POST /api/links/batch-csv
 *
 * Marketing teams often prepare a spread of destinations (20+ channels per
 * campaign) in a spreadsheet. This endpoint takes a CSV where **each row
 * is a fully independent link** — its own URL, UTM set, tags, expiry — and
 * creates them all in a single request.
 *
 * Contract:
 *   - Content-Type: multipart/form-data
 *   - Single field `file` containing the CSV
 *   - First row = header, case-insensitive, expected columns (extras ignored):
 *       original_url (required)
 *       title, custom_code
 *       utm_source, utm_medium, utm_campaign, utm_content, utm_term
 *       tags           (comma-separated tag names; auto-created if missing)
 *       max_clicks     (integer)
 *       expires_at     (ISO 8601 datetime)
 *       redirect_type  (PERMANENT | TEMPORARY, default TEMPORARY)
 *
 * Governance: each row's UTM source/medium is checked against the
 * workspace whitelist. Rows that violate return { ok: false, error } in
 * the per-row results array — they don't fail the whole batch.
 *
 * Per-row errors (bad URL, duplicate code, governance violation) are
 * collected and returned with status 200 so partial batches surface.
 * Hard failures (no file, zero valid rows, parse error) return 400.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceScope } from "@/lib/workspace";
import {
  createShortCode,
  isReservedCode,
  isValidCustomCode,
} from "@/lib/utils/shortcode";
import { bumpLinksCache } from "@/lib/cache-scopes";
import {
  getWorkspaceUtmGovernance,
  validateUtmAgainstGovernance,
} from "@/lib/utm-governance";
import Papa from "papaparse";
import { z } from "zod";

// Hard cap so one upload can't exhaust Lambda time / memory.
const MAX_ROWS = 500;

const rowSchema = z.object({
  original_url: z.string().url(),
  title: z.string().optional().nullable(),
  custom_code: z.string().optional().nullable(),
  utm_source: z.string().optional().nullable(),
  utm_medium: z.string().optional().nullable(),
  utm_campaign: z.string().optional().nullable(),
  utm_content: z.string().optional().nullable(),
  utm_term: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  max_clicks: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? parseInt(v, 10) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), {
      message: "max_clicks must be a positive integer",
    }),
  expires_at: z.string().optional().nullable(),
  redirect_type: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v.toUpperCase() : null))
    .refine((v) => v === null || v === "PERMANENT" || v === "TEMPORARY", {
      message: "redirect_type must be PERMANENT or TEMPORARY",
    }),
});

type RowResult =
  | { row: number; ok: true; id: string; code: string; originalUrl: string }
  | { row: number; ok: false; error: string };

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scope = await resolveWorkspaceScope(request, session);
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No CSV file uploaded" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        {
          error: "CSV parse error",
          details: parsed.errors.slice(0, 5).map((e) => e.message),
        },
        { status: 400 },
      );
    }

    const rows = parsed.data;
    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV is empty" }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Too many rows (max ${MAX_ROWS})` },
        { status: 400 },
      );
    }

    const governance = await getWorkspaceUtmGovernance(scope.workspaceId);

    // Resolve tag names → tag IDs up-front. Collect unique names across all
    // rows so we only make one DB roundtrip per tag. Missing tags are created
    // in the current workspace (null for user-scope mode is allowed by schema).
    const tagNames = new Set<string>();
    for (const r of rows) {
      const raw = (r.tags ?? "").trim();
      if (!raw) continue;
      raw.split(",").map((t) => t.trim()).filter(Boolean).forEach((n) => tagNames.add(n));
    }

    const tagNameToId = new Map<string, string>();
    if (tagNames.size > 0) {
      const existing = await prisma.tag.findMany({
        where: {
          name: { in: Array.from(tagNames) },
          ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
        },
        select: { id: true, name: true },
      });
      existing.forEach((t) => tagNameToId.set(t.name, t.id));

      const missing = Array.from(tagNames).filter((n) => !tagNameToId.has(n));
      for (const name of missing) {
        // upsert rather than createMany so concurrent imports don't race on
        // the @unique(name) constraint.
        const tag = await prisma.tag.upsert({
          where: { name },
          update: {},
          create: { name, workspaceId: scope.workspaceId ?? undefined },
        });
        tagNameToId.set(name, tag.id);
      }
    }

    const results: RowResult[] = [];

    // Sequential loop — each row needs a unique short code + collision
    // check, and governance/tag writes are cheap. Parallelism would just
    // contend on the short_links.code unique index.
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +2 because row 1 is the header for users
      const raw = rows[i];

      const parsedRow = rowSchema.safeParse(raw);
      if (!parsedRow.success) {
        results.push({
          row: rowNumber,
          ok: false,
          error: parsedRow.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; "),
        });
        continue;
      }
      const r = parsedRow.data;

      // Governance check per row
      const govErrors = validateUtmAgainstGovernance(governance, {
        source: r.utm_source,
        medium: r.utm_medium,
      });
      if (govErrors.length > 0) {
        results.push({ row: rowNumber, ok: false, error: govErrors.join("; ") });
        continue;
      }

      // Resolve short code
      let code = r.custom_code?.trim() || "";
      if (code) {
        if (!isValidCustomCode(code)) {
          results.push({ row: rowNumber, ok: false, error: `Invalid custom code "${code}"` });
          continue;
        }
        if (isReservedCode(code)) {
          results.push({ row: rowNumber, ok: false, error: `Reserved code "${code}"` });
          continue;
        }
        const dupe = await prisma.shortLink.findUnique({ where: { code } });
        if (dupe) {
          results.push({ row: rowNumber, ok: false, error: `Code "${code}" already exists` });
          continue;
        }
      } else {
        let attempts = 0;
        do {
          code = createShortCode();
          const existing = await prisma.shortLink.findUnique({ where: { code } });
          if (!existing) break;
          attempts++;
        } while (attempts < 10);
        if (attempts >= 10) {
          results.push({ row: rowNumber, ok: false, error: "Failed to allocate unique code" });
          continue;
        }
      }

      // Build final URL with UTM params
      let finalUrl: string;
      try {
        const u = new URL(r.original_url);
        if (r.utm_source) u.searchParams.set("utm_source", r.utm_source);
        if (r.utm_medium) u.searchParams.set("utm_medium", r.utm_medium);
        if (r.utm_campaign) u.searchParams.set("utm_campaign", r.utm_campaign);
        if (r.utm_content) u.searchParams.set("utm_content", r.utm_content);
        if (r.utm_term) u.searchParams.set("utm_term", r.utm_term);
        finalUrl = u.toString();
      } catch {
        results.push({ row: rowNumber, ok: false, error: "Invalid original_url" });
        continue;
      }

      // Parse expires_at if present
      let expiresAt: Date | null = null;
      if (r.expires_at) {
        const d = new Date(r.expires_at);
        if (isNaN(d.getTime())) {
          results.push({ row: rowNumber, ok: false, error: "Invalid expires_at datetime" });
          continue;
        }
        expiresAt = d;
      }

      // Resolve tags for this row
      const rowTagIds: string[] = [];
      if (r.tags) {
        for (const name of r.tags.split(",").map((t) => t.trim()).filter(Boolean)) {
          const id = tagNameToId.get(name);
          if (id) rowTagIds.push(id);
        }
      }

      try {
        const created = await prisma.shortLink.create({
          data: {
            code,
            originalUrl: finalUrl,
            title: r.title || null,
            redirectType: (r.redirect_type as "PERMANENT" | "TEMPORARY" | null) ?? "TEMPORARY",
            expiresAt,
            maxClicks: r.max_clicks ?? null,
            utmSource: r.utm_source ?? null,
            utmMedium: r.utm_medium ?? null,
            utmCampaign: r.utm_campaign ?? null,
            utmContent: r.utm_content ?? null,
            utmTerm: r.utm_term ?? null,
            createdById: session.user.id,
            workspaceId: scope.workspaceId ?? undefined,
            ...(rowTagIds.length > 0 && {
              tags: {
                create: rowTagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
              },
            }),
          },
        });

        results.push({
          row: rowNumber,
          ok: true,
          id: created.id,
          code: created.code,
          originalUrl: created.originalUrl,
        });
      } catch (err) {
        results.push({
          row: rowNumber,
          ok: false,
          error: err instanceof Error ? err.message : "DB error",
        });
      }
    }

    const createdCount = results.filter((r) => r.ok).length;
    const failedCount = results.length - createdCount;

    // Single audit log for the whole batch — per-row audits would be noisy
    // and the results array already captures per-row outcome.
    if (createdCount > 0) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE_LINK",
          metadata: {
            batchCsv: true,
            total: rows.length,
            created: createdCount,
            failed: failedCount,
          },
        },
      });
      await bumpLinksCache(scope.workspaceId, session.user.id);
    }

    return NextResponse.json({
      total: rows.length,
      created: createdCount,
      failed: failedCount,
      results,
    });
  } catch (error) {
    console.error("CSV batch import failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    );
  }
}
