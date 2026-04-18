import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import CSVImportClient from "./CSVImportClient";

export function generateMetadata() {
  return { title: "Import Links from CSV" };
}

export default function CSVImportPage() {
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 bg-slate-100 border-b border-slate-200">
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#03A9F4]" />
            Import Links from CSV
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Upload a CSV with one row per link — each can have its own URL,
            UTM set, tags, expiry and custom code. Great for rolling out
            20+ channel variants in one go.
          </p>
        </div>
        <div className="p-6">
          <CSVImportClient />
        </div>
      </div>
    </div>
  );
}
