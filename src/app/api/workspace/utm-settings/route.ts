import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceId } from "@/lib/workspace";
import { z } from "zod";

const utmSettingsSchema = z.object({
  approvedSources: z.array(z.string().min(1).max(100)).max(50),
  approvedMediums: z.array(z.string().min(1).max(100)).max(50),
});

// GET /api/workspace/utm-settings
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ approvedSources: [], approvedMediums: [] });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { utmSettings: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const settings = workspace.utmSettings as {
      approvedSources?: string[];
      approvedMediums?: string[];
    } | null;

    return NextResponse.json({
      approvedSources: settings?.approvedSources ?? [],
      approvedMediums: settings?.approvedMediums ?? [],
    });
  } catch (error) {
    console.error("Failed to fetch UTM settings:", error);
    return NextResponse.json({ error: "Failed to fetch UTM settings" }, { status: 500 });
  }
}

// PATCH /api/workspace/utm-settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN / MANAGER can update governance settings
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workspaceId = getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: "Workspace required" }, { status: 400 });
    }

    const body = await request.json();
    const validated = utmSettingsSchema.parse(body);

    // Normalize: trim and lowercase
    const normalized = {
      approvedSources: [...new Set(validated.approvedSources.map((s) => s.trim().toLowerCase()))].filter(Boolean),
      approvedMediums: [...new Set(validated.approvedMediums.map((m) => m.trim().toLowerCase()))].filter(Boolean),
    };

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { utmSettings: normalized },
    });

    return NextResponse.json({ success: true, ...normalized });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Failed to update UTM settings:", error);
    return NextResponse.json({ error: "Failed to update UTM settings" }, { status: 500 });
  }
}
