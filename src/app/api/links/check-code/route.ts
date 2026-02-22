import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidCustomCode, isReservedCode } from "@/lib/utils/shortcode";

// GET /api/links/check-code?code=my-slug
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code") || "";

    if (!code) {
      return NextResponse.json({ available: null, reason: "empty" });
    }

    if (!isValidCustomCode(code)) {
      return NextResponse.json({
        available: false,
        reason: "invalid_format",
        message: "3–50 alphanumeric characters, hyphens, or underscores",
      });
    }

    if (isReservedCode(code)) {
      return NextResponse.json({
        available: false,
        reason: "reserved",
        message: "This code is reserved",
      });
    }

    const existing = await prisma.shortLink.findUnique({ where: { code } });

    return NextResponse.json({
      available: !existing,
      reason: existing ? "taken" : "ok",
    });
  } catch (error) {
    console.error("Code check failed:", error);
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}
