import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { WorkspaceRole } from "@prisma/client";
import crypto from "crypto";

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

// GET /api/workspaces/[id]/invitations - List pending invitations
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

    // Only OWNER and ADMIN can view invitations
    const access = await checkWorkspaceAccess(id, session.user.id, ["OWNER", "ADMIN"]);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const invitations = await prisma.workspaceInvitation.findMany({
      where: {
        workspaceId: id,
        status: "PENDING",
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error("Failed to fetch invitations:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}

// Validation schema for creating invitation
const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

// POST /api/workspaces/[id]/invitations - Create new invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Only OWNER and ADMIN can invite
    const access = await checkWorkspaceAccess(id, session.user.id, ["OWNER", "ADMIN"]);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    const validated = createInvitationSchema.parse(body);

    // Only OWNER can invite as ADMIN
    if (validated.role === "ADMIN" && access.member.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only owners can invite admins" },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: id,
            userId: existingUser.id,
          },
        },
      });

      if (existingMember) {
        return NextResponse.json(
          { error: "User is already a member of this workspace" },
          { status: 400 }
        );
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId: id,
        email: validated.email,
        status: "PENDING",
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "An invitation has already been sent to this email" },
        { status: 400 }
      );
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString("hex");

    // Create invitation (expires in 7 days)
    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId: id,
        email: validated.email,
        role: validated.role as WorkspaceRole,
        token,
        invitedById: session.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      include: {
        workspace: {
          select: {
            name: true,
            slug: true,
          },
        },
        invitedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "INVITE_MEMBER",
        targetId: invitation.id,
        metadata: {
          workspaceId: id,
          invitedEmail: validated.email,
          role: validated.role,
        },
      },
    });

    // TODO: Send invitation email
    // For now, just return the invitation with the invite URL
    const inviteUrl = `${process.env.NEXTAUTH_URL || ""}/invite/${token}`;

    return NextResponse.json(
      {
        invitation: {
          ...invitation,
          inviteUrl,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Failed to create invitation:", error);
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/[id]/invitations - Cancel invitation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get("invitationId");

    if (!invitationId) {
      return NextResponse.json({ error: "Invitation ID required" }, { status: 400 });
    }

    // Only OWNER and ADMIN can cancel invitations
    const access = await checkWorkspaceAccess(id, session.user.id, ["OWNER", "ADMIN"]);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.workspaceId !== id) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    // Update invitation status to cancelled
    await prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to cancel invitation:", error);
    return NextResponse.json(
      { error: "Failed to cancel invitation" },
      { status: 500 }
    );
  }
}
