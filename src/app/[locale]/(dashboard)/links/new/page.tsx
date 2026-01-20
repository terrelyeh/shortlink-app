import { getTranslations } from "next-intl/server";
import { CreateLinkForm } from "@/components/forms/CreateLinkForm";
import { ArrowLeft, Sparkles } from "lucide-react";
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
      <div className="mb-8">
        <Link
          href="/links"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Links</span>
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 bg-slate-100 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {t("createNew")}
              </h1>
              <p className="text-slate-500 text-sm">
                Create a short link to share with the world
              </p>
            </div>
          </div>
        </div>

        {/* Form content */}
        <div className="p-8">
          <CreateLinkForm />
        </div>
      </div>
    </div>
  );
}
