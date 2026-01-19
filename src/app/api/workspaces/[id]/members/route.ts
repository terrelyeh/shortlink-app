import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { WorkspaceRole } from "@prisma/client";

// Helper to check workspace access and role
async function checkWorkspaceAccess(
  workspaceId: string,
  userId: string,
  requiredRoles?: WorkspaceRole[]
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

// GET /api/workspaces/[id]/members - List workspace members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const access = await checkWorkspaceAccess(id, session.user.id);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: id },
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
        { role: "asc" },
        { joinedAt: "asc" },
      ],
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Failed to fetch members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

// Validation schema for updating member role
const updateMemberSchema = z.object({
  memberId: z.string(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
});

// PATCH /api/workspaces/[id]/members - Update member role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Only OWNER and ADMIN can update member roles
    const access = await checkWorkspaceAccess(id, session.user.id, ["OWNER", "ADMIN"]);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    const validated = updateMemberSchema.parse(body);

    // Get the member to update
    const targetMember = await prisma.workspaceMember.findUnique({
      where: { id: validated.memberId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!targetMember || targetMember.workspaceId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Only OWNER can change roles to/from OWNER
    if (
      (targetMember.role === "OWNER" || validated.role === "OWNER") &&
      access.member.role !== "OWNER"
    ) {
      return NextResponse.json(
        { error: "Only owners can transfer or assign ownership" },
        { status: 403 }
      );
    }

    // Prevent removing the last OWNER
    if (targetMember.role === "OWNER" && validated.role !== "OWNER") {
      const ownerCount = await prisma.workspaceMember.count({
        where: {
          workspaceId: id,
          role: "OWNER",
        },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last owner. Transfer ownership first." },
          { status: 400 }
        );
      }
    }

    // Update member role
    const updatedMember = await prisma.workspaceMember.update({
      where: { id: validated.memberId },
      data: { role: validated.role as WorkspaceRole },
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
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_MEMBER_ROLE",
        targetId: validated.memberId,
        metadata: {
          workspaceId: id,
          memberEmail: targetMember.user.email,
          oldRole: targetMember.role,
          newRole: validated.role,
        },
      },
    });

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Failed to update member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/[id]/members - Remove member from workspace
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "Member ID required" }, { status: 400 });
    }

    // Get target member first
    const targetMember = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!targetMember || targetMember.workspaceId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Allow self-removal (leaving workspace) or admin removal
    const isSelfRemoval = targetMember.userId === session.user.id;

    if (!isSelfRemoval) {
      // Need OWNER or ADMIN to remove others
      const access = await checkWorkspaceAccess(id, session.user.id, ["OWNER", "ADMIN"]);
      if ("error" in access) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }

      // Only OWNER can remove ADMIN or other OWNER
      if (
        (targetMember.role === "OWNER" || targetMember.role === "ADMIN") &&
        access.member.role !== "OWNER"
      ) {
        return NextResponse.json(
          { error: "Only owners can remove admins or other owners" },
          { status: 403 }
        );
      }
    }

    // Prevent removing the last OWNER
    if (targetMember.role === "OWNER") {
      const ownerCount = await prisma.workspaceMember.count({
        where: {
          workspaceId: id,
          role: "OWNER",
        },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last owner. Transfer ownership or delete the workspace." },
          { status: 400 }
        );
      }
    }

    // Remove member
    await prisma.workspaceMember.delete({
      where: { id: memberId },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "REMOVE_MEMBER",
        targetId: memberId,
        metadata: {
          workspaceId: id,
          memberEmail: targetMember.user.email,
          memberRole: targetMember.role,
          isSelfRemoval,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
