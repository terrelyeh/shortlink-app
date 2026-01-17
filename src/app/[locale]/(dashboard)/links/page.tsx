import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Plus, Search, Filter } from "lucide-react";

export async function generateMetadata() {
  const t = await getTranslations("links");
  return {
    title: t("title"),
  };
}

export default function LinksPage() {
  const t = useTranslations("links");
  const tCommon = useTranslations("common");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <Link
          href="/links/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t("createNew")}
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={tCommon("search")}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <Filter className="w-5 h-5" />
          {tCommon("filter")}
        </button>
      </div>

      {/* Links Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-500">
                <th className="px-6 py-3 font-medium">{t("shortUrl")}</th>
                <th className="px-6 py-3 font-medium">{t("originalUrl")}</th>
                <th className="px-6 py-3 font-medium">{t("clicks")}</th>
                <th className="px-6 py-3 font-medium">{t("status")}</th>
                <th className="px-6 py-3 font-medium">{t("createdAt")}</th>
                <th className="px-6 py-3 font-medium">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Empty state */}
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Link className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 mb-2">{t("noLinks")}</p>
                    <Link
                      href="/links/new"
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {t("createFirst")}
                    </Link>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
