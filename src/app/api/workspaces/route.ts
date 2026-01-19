import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

// GET /api/workspaces - List all workspaces the user is a member of
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: session.user.id,
          },
        },
      },
      include: {
        members: {
          where: {
            userId: session.user.id,
          },
          select: {
            role: true,
          },
        },
        _count: {
          select: {
            members: true,
            shortLinks: true,
            campaigns: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform to include user's role
    const transformedWorkspaces = workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      description: ws.description,
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
      role: ws.members[0]?.role || "VIEWER",
      memberCount: ws._count.members,
      linkCount: ws._count.shortLinks,
      campaignCount: ws._count.campaigns,
    }));

    return NextResponse.json({ workspaces: transformedWorkspaces });
  } catch (error) {
    console.error("Failed to fetch workspaces:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 }
    );
  }
}

// Validation schema for creating workspace
const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().max(500).optional(),
});

// POST /api/workspaces - Create a new workspace
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createWorkspaceSchema.parse(body);

    // Check if slug already exists
    const existingWorkspace = await prisma.workspace.findUnique({
      where: { slug: validated.slug },
    });

    if (existingWorkspace) {
      return NextResponse.json(
        { error: "Workspace slug already exists" },
        { status: 400 }
      );
    }

    // Create workspace and add creator as owner
    const workspace = await prisma.workspace.create({
      data: {
        name: validated.name,
        slug: validated.slug,
        description: validated.description,
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
            shortLinks: true,
            campaigns: true,
          },
        },
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_WORKSPACE",
        targetId: workspace.id,
        metadata: {
          name: workspace.name,
          slug: workspace.slug,
        },
      },
    });

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Failed to create workspace:", error);
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    );
  }
}
