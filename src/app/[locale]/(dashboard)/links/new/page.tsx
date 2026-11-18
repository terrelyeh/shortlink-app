import { getTranslations } from "next-intl/server";
import { CreateLinkForm } from "@/components/forms/CreateLinkForm";
import { ChevronLeft, Link2 } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function generateMetadata() {
  const t = await getTranslations("links");
  return { title: t("createNew") };
}

/**
 * Prefill from the URL so entry points elsewhere actually carry context:
 *   ?utmCampaign=NAME  — "add link" buttons on a campaign's page
 *   ?template=ID       — "use template" on /templates
 * Resolved here (server side) so the form starts filled, no effect needed.
 */
async function resolvePrefill(params: { utmCampaign?: string; template?: string }) {
  const prefill: {
    utmCampaign?: string;
    utmSource?: string;
    utmMedium?: string;
    utmContent?: string;
    utmTerm?: string;
    templateName?: string;
  } = {};
  if (params.utmCampaign) prefill.utmCampaign = params.utmCampaign.slice(0, 200);

  if (params.template) {
    const session = await auth();
    if (session?.user?.id) {
      // Same visibility as the templates list: the caller's workspaces,
      // or templates they created themselves.
      const memberships = await prisma.workspaceMember.findMany({
        where: { userId: session.user.id },
        select: { workspaceId: true },
      });
      const template = await prisma.uTMTemplate.findFirst({
        where: {
          id: params.template,
          OR: [
            { workspaceId: { in: memberships.map((m) => m.workspaceId) } },
            { createdById: session.user.id },
          ],
        },
      });
      if (template) {
        prefill.utmSource = template.source ?? undefined;
        prefill.utmMedium = template.medium ?? undefined;
        prefill.utmContent = template.content ?? undefined;
        prefill.utmTerm = template.term ?? undefined;
        prefill.templateName = template.name;
      }
    }
  }
  return prefill;
}

export default async function NewLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ utmCampaign?: string; template?: string }>;
}) {
  const t = await getTranslations("links");
  const prefill = await resolvePrefill(await searchParams);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Link href="/links" className="back-link">
        <ChevronLeft size={13} /> {t("trashBack")}
      </Link>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "var(--brand-50)",
              color: "var(--brand-600)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Link2 size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-100)" }}>
              {t("createNew")}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
              {t("createSubtitle")}
            </div>
          </div>
        </div>
        <CreateLinkForm prefill={prefill} />
      </div>
    </div>
  );
}
