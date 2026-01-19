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

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {t("createNew")}
              </h1>
              <p className="text-blue-100 text-sm mt-0.5">
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
