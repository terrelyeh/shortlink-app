import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateLinkSchema = z.object({
  originalUrl: z.string().url().optional(),
  title: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
  redirectType: z.enum(["PERMANENT", "TEMPORARY"]).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  maxClicks: z.number().int().positive().optional().nullable(),
});

// GET - Get single link
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
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { clicks: true } },
        tags: { include: { tag: true } },
      },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    // Check access
    if (session.user.role === "MEMBER" && link.createdById !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json(link);
  } catch (error) {
    console.error("Failed to fetch link:", error);
    return NextResponse.json({ error: "Failed to fetch link" }, { status: 500 });
  }
}

// PATCH - Update link
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = updateLinkSchema.parse(body);

    // Get existing link
    const existingLink = await prisma.shortLink.findUnique({
      where: { id },
    });

    if (!existingLink) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    // Check permission
    if (
      session.user.role === "MEMBER" &&
      existingLink.createdById !== session.user.id
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update the link
    const updatedLink = await prisma.shortLink.update({
      where: { id },
      data: {
        ...(validated.originalUrl && { originalUrl: validated.originalUrl }),
        ...(validated.title !== undefined && { title: validated.title }),
        ...(validated.status && { status: validated.status }),
        ...(validated.redirectType && { redirectType: validated.redirectType }),
        ...(validated.expiresAt !== undefined && {
          expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
        }),
        ...(validated.maxClicks !== undefined && { maxClicks: validated.maxClicks }),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_LINK",
        targetId: id,
        metadata: { changes: validated },
      },
    });

    return NextResponse.json(updatedLink);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Failed to update link:", error);
    return NextResponse.json({ error: "Failed to update link" }, { status: 500 });
  }
}

// DELETE - Soft delete link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get existing link
    const existingLink = await prisma.shortLink.findUnique({
      where: { id },
    });

    if (!existingLink) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    // Check permission
    if (
      session.user.role === "MEMBER" &&
      existingLink.createdById !== session.user.id
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Soft delete
    await prisma.shortLink.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_LINK",
        targetId: id,
        metadata: { code: existingLink.code },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete link:", error);
    return NextResponse.json({ error: "Failed to delete link" }, { status: 500 });
  }
}
