import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const createShareSchema = z.object({
  shortLinkId: z.string(),
  password: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  maxViews: z.number().int().positive().optional(),
});

// POST - Create share token
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createShareSchema.parse(body);

    // Check if user owns the link or has permission
    const link = await prisma.shortLink.findUnique({
      where: { id: validated.shortLinkId },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (session.user.role === "MEMBER" && link.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Generate unique token
    const token = randomBytes(32).toString("hex");

    // Hash password if provided
    let hashedPassword: string | null = null;
    if (validated.password) {
      hashedPassword = await bcrypt.hash(validated.password, 10);
    }

    const shareToken = await prisma.shareToken.create({
      data: {
        shortLinkId: validated.shortLinkId,
        token,
        password: hashedPassword,
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
        maxViews: validated.maxViews,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SHARE_LINK",
        targetId: validated.shortLinkId,
        metadata: { shareTokenId: shareToken.id },
      },
    });

    return NextResponse.json({
      ...shareToken,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/share/${token}`,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Failed to create share token:", error);
    return NextResponse.json({ error: "Failed to create share token" }, { status: 500 });
  }
}
