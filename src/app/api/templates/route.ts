import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const templateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  source: z.string().optional(),
  medium: z.string().optional(),
  campaign: z.string().optional(),
  content: z.string().optional(),
  term: z.string().optional(),
});

// GET - List templates
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const templates = await prisma.uTMTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

// POST - Create template
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = templateSchema.parse(body);

    const template = await prisma.uTMTemplate.create({
      data: {
        ...validated,
        userId: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_TEMPLATE",
        targetId: template.id,
        metadata: { name: template.name },
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Failed to create template:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
