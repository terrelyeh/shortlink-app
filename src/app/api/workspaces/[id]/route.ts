import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Helper to check workspace access and role
async function checkWorkspaceAccess(
  workspaceId: string,
  userId: string,
  requiredRoles?: string[]
) {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    include: {
      workspace: true,
    },
  });

  if (!member) {
    return { error: "Workspace not found or access denied", status: 404 };
  }

  if (requiredRoles && !requiredRoles.includes(member.role)) {
    return { error: "Insufficient permissions", status: 403 };
  }

  return { member, workspace: member.workspace };
}

// GET /api/workspaces/[id] - Get workspace details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const access = await checkWorkspaceAccess(id, session.user.id);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id },
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
          orderBy: [
            { role: "asc" }, // OWNER first, then ADMIN, etc.
            { joinedAt: "asc" },
          ],
        },
        _count: {
          select: {
            members: true,
            shortLinks: true,
            campaigns: true,
            templates: true,
          },
        },
      },
    });

    return NextResponse.json({
      workspace: {
        ...workspace,
        currentUserRole: access.member.role,
      },
    });
  } catch (error) {
    console.error("Failed to fetch workspace:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace" },
      { status: 500 }
    );
  }
}

// Validation schema for updating workspace
const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only")
    .optional(),
  description: z.string().max(500).optional().nullable(),
});

// PATCH /api/workspaces/[id] - Update workspace
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Only OWNER and ADMIN can update workspace
    const access = await checkWorkspaceAccess(id, session.user.id, ["OWNER", "ADMIN"]);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    const validated = updateWorkspaceSchema.parse(body);

    // Check if slug is being changed and if it's already taken
    if (validated.slug && validated.slug !== access.workspace.slug) {
      const existingWorkspace = await prisma.workspace.findUnique({
        where: { slug: validated.slug },
      });
      if (existingWorkspace) {
        return NextResponse.json(
          { error: "Workspace slug already exists" },
          { status: 400 }
        );
      }
    }

    const workspace = await prisma.workspace.update({
      where: { id },
      data: validated,
      include: {
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
        action: "UPDATE_WORKSPACE",
        targetId: workspace.id,
        metadata: {
          changes: validated,
        },
      },
    });

    return NextResponse.json({ workspace });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Failed to update workspace:", error);
    return NextResponse.json(
      { error: "Failed to update workspace" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/[id] - Delete workspace
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Only OWNER can delete workspace
    const access = await checkWorkspaceAccess(id, session.user.id, ["OWNER"]);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Log audit before deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_WORKSPACE",
        targetId: id,
        metadata: {
          name: access.workspace.name,
          slug: access.workspace.slug,
        },
      },
    });

    // Delete workspace (cascades to all related resources)
    await prisma.workspace.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete workspace:", error);
    return NextResponse.json(
      { error: "Failed to delete workspace" },
      { status: 500 }
    );
  }
}
