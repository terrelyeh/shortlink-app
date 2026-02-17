import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Check destination URL and return metadata
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const link = await prisma.shortLink.findUnique({
      where: { id },
      select: { originalUrl: true, createdById: true },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (session.user.role === "MEMBER" && link.createdById !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check destination URL
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(link.originalUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "ShortLinkManager/1.0 LinkChecker",
        },
      });

      clearTimeout(timeout);

      return NextResponse.json({
        url: link.originalUrl,
        finalUrl: response.url,
        status: response.status,
        statusText: response.statusText,
        reachable: response.ok,
        redirected: response.url !== link.originalUrl,
        contentType: response.headers.get("content-type"),
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      return NextResponse.json({
        url: link.originalUrl,
        reachable: false,
        error: fetchError instanceof Error ? fetchError.message : "Failed to reach destination",
      });
    }
  } catch (error) {
    console.error("Failed to check link:", error);
    return NextResponse.json({ error: "Failed to check link" }, { status: 500 });
  }
}
