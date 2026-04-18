import { getTranslations } from "next-intl/server";
import { CreateLinkForm } from "@/components/forms/CreateLinkForm";
import { ChevronLeft, Link2 } from "lucide-react";
import Link from "next/link";

export async function generateMetadata() {
  const t = await getTranslations("links");
  return { title: t("createNew") };
}

export default async function NewLinkPage() {
  const t = await getTranslations("links");

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Link href="/links" className="back-link">
        <ChevronLeft size={13} /> Back to Links
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
              Create a short link to share with the world
            </div>
          </div>
        </div>
        <CreateLinkForm />
      </div>
    </div>
  );
}
