import { getTranslations } from "next-intl/server";
import { BatchCreateForm } from "@/components/forms/BatchCreateForm";
import { ChevronLeft, Layers } from "lucide-react";
import Link from "next/link";

export async function generateMetadata() {
  const t = await getTranslations("utm");
  return { title: t("batchCreate") };
}

export default async function BatchCreatePage() {
  const t = await getTranslations("utm");

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link href="/links" className="back-link">
        <ChevronLeft size={13} /> Back to Links
      </Link>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
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
            <Layers size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-100)" }}>
              {t("batchCreate")}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
              Create multiple short links at once with different UTM content values.
            </div>
          </div>
        </div>
        <BatchCreateForm />
      </div>
    </div>
  );
}
