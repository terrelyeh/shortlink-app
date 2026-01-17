import { getTranslations } from "next-intl/server";
import { CreateLinkForm } from "@/components/forms/CreateLinkForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export async function generateMetadata() {
  const t = await getTranslations("links");
  return {
    title: t("createNew"),
  };
}

export default async function NewLinkPage() {
  const t = await getTranslations("links");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/links"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Links
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {t("createNew")}
        </h1>
        <CreateLinkForm />
      </div>
    </div>
  );
}
