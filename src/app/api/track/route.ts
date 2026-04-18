/**
 * POST /api/track — public conversion tracking endpoint.
 *
 * Called from landing pages via the `/track.js` snippet (or server-side
 * from backend webhooks). Attributes a conversion back to a prior click
 * using the opaque session ID handed out on redirect.
 *
 * Security / abuse:
 *   - CORS wide open (`*`). Attribution requires a valid sessionId, which
 *     only exists if the visitor actually went through a /s/<code>
 *     redirect recently, so anonymous POSTs can't fabricate data for
 *     arbitrary short links.
 *   - Rate limit 60/min per IP (reuse `allowRedirect`). Same limiter is
 *     fine — the abuse profile is similar (high-volume scripted POSTs).
 *   - Idempotency: when the caller supplies `externalId` (e.g. order_id),
 *     a second POST with the same (shortLinkId, externalId) returns the
 *     already-stored conversion instead of duplicating.
 *   - Attribution window: 30 days. Older clicks won't match by sessionId
 *     even if a landing page somehow retained it that long.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { allowRedirect } from "@/lib/ratelimit";
import { z } from "zod";

const ATTRIBUTION_WINDOW_DAYS = 30;

const trackSchema = z.object({
  sessionId: z.string().min(1, "sessionId required").max(64),
  eventName: z.string().max(60).optional(),
  value: z.number().finite().nonnegative().optional(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, "Currency must be ISO 4217 (e.g. TWD, USD)")
    .optional(),
  externalId: z.string().max(120).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Small CORS helper — landing pages can be on any domain, so we keep
// origin wide-open. Attribution still requires a valid sessionId.
function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);

  try {
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0] ||
      headersList.get("x-real-ip") ||
      "unknown";

    if (!(await allowRedirect(ip))) {
      return NextResponse.json(
        { ok: false, error: "Rate limited" },
        { status: 429, headers: cors },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = trackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid payload",
          details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        { status: 400, headers: cors },
      );
    }
    const data = parsed.data;

    // Look up the originating click. Must be within the attribution window.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ATTRIBUTION_WINDOW_DAYS);

    const click = await prisma.click.findUnique({
      where: { sessionId: data.sessionId },
      select: {
        id: true,
        shortLinkId: true,
        workspaceId: true,
        variantId: true,
        timestamp: true,
      },
    });

    if (!click) {
      return NextResponse.json(
        { ok: false, error: "Unknown session" },
        { status: 404, headers: cors },
      );
    }
    if (click.timestamp < cutoff) {
      return NextResponse.json(
        { ok: false, error: "Session expired" },
        { status: 410, headers: cors },
      );
    }

    // Idempotency — reuse existing conversion when externalId + shortLinkId
    // match. Lets retries from flaky networks / shopify webhooks be safe.
    if (data.externalId) {
      const existing = await prisma.conversion.findUnique({
        where: {
          shortLinkId_externalId: {
            shortLinkId: click.shortLinkId,
            externalId: data.externalId,
          },
        },
      });
      if (existing) {
        return NextResponse.json(
          { ok: true, conversionId: existing.id, deduped: true },
          { headers: cors },
        );
      }
    }

    const conversion = await prisma.conversion.create({
      data: {
        clickId: click.id,
        shortLinkId: click.shortLinkId,
        workspaceId: click.workspaceId ?? undefined,
        variantId: click.variantId,
        eventName: data.eventName ?? "conversion",
        value: data.value !== undefined ? data.value : null,
        currency: data.currency ?? null,
        externalId: data.externalId ?? null,
        // Cast to Prisma's InputJsonValue — zod already guarantees it's a
        // plain object of JSON-serialisable values.
        metadata: (data.metadata ?? undefined) as unknown as
          | import("@prisma/client").Prisma.InputJsonValue
          | undefined,
      },
    });

    return NextResponse.json(
      { ok: true, conversionId: conversion.id },
      { headers: cors },
    );
  } catch (err) {
    console.error("[track] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500, headers: cors },
    );
  }
}
