import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceId } from "@/lib/workspace";
import { z } from "zod";

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

// GET - List all tags
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = getWorkspaceId(request);
    const where: Record<string, unknown> = {};
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    const tags = await prisma.tag.findMany({
      where,
      include: {
        _count: { select: { links: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("Failed to fetch tags:", error);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}

// POST - Create a new tag
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createTagSchema.parse(body);

    // Check if tag already exists
    const existing = await prisma.tag.findUnique({
      where: { name: validated.name },
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    const workspaceId = getWorkspaceId(request);
    const tag = await prisma.tag.create({
      data: {
        name: validated.name,
        color: validated.color,
        workspaceId: workspaceId || undefined,
      },
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Failed to create tag:", error);
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
  }
}
