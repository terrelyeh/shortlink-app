import { getTranslations } from "next-intl/server";
import { BatchCreateForm } from "@/components/forms/BatchCreateForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export async function generateMetadata() {
  const t = await getTranslations("utm");
  return {
    title: t("batchCreate"),
  };
}

export default async function BatchCreatePage() {
  const t = await getTranslations("utm");

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href="/links"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Links
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {t("batchCreate")}
        </h1>
        <p className="text-slate-500 mb-6">
          Create multiple short links at once with different UTM content values.
          Perfect for KOL campaigns or A/B testing.
        </p>
        <BatchCreateForm />
      </div>
    </div>
  );
}
