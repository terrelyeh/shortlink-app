"use client";

import { useCallback, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Upload,
  Download,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

// Columns matter — order is what we put in the downloadable template.
// The server parses by header name so users *can* reorder if they want.
const TEMPLATE_COLUMNS = [
  "original_url",
  "title",
  "custom_code",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "tags",
  "max_clicks",
  "starts_at",
  "expires_at",
  "allowed_countries",
  "redirect_type",
] as const;

const TEMPLATE_SAMPLE: Record<string, string> = {
  original_url: "https://example.com/landing",
  title: "Spring Sale — FB Ad A",
  custom_code: "",
  utm_source: "facebook",
  utm_medium: "cpc",
  utm_campaign: "spring_sale_2026",
  utm_content: "creative_a",
  utm_term: "",
  tags: "spring,ads",
  max_clicks: "",
  starts_at: "",
  expires_at: "",
  allowed_countries: "TW,JP",
  redirect_type: "TEMPORARY",
};

type RowResult =
  | { row: number; ok: true; id: string; code: string; originalUrl: string }
  | { row: number; ok: false; error: string };

interface ImportResponse {
  total: number;
  created: number;
  failed: number;
  results: RowResult[];
}

export default function CSVImportClient() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState<ImportResponse | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const downloadTemplate = () => {
    const header = TEMPLATE_COLUMNS.join(",");
    const sampleRow = TEMPLATE_COLUMNS.map((c) => {
      const v = TEMPLATE_SAMPLE[c] ?? "";
      return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(",");
    const csv = `${header}\n${sampleRow}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shortlink-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setParseError(null);
    setResponse(null);
    setServerError(null);

    // Parse client-side for a preview so the user can sanity-check before
    // submitting. Server re-parses authoritatively.
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      preview: 5,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (result) => {
        if (result.errors.length > 0) {
          setParseError(result.errors[0].message);
          return;
        }
        setPreviewHeaders(result.meta.fields ?? []);
        setPreview(result.data);
      },
      error: (err) => setParseError(err.message),
    });
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.toLowerCase().endsWith(".csv")) handleFile(f);
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setPreviewHeaders([]);
    setParseError(null);
    setResponse(null);
    setServerError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async () => {
    if (!file) return;
    setSubmitting(true);
    setServerError(null);
    setResponse(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/links/batch-csv", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setServerError(
          data.details ? `${data.error}: ${data.details.join("; ")}` : data.error || "Import failed",
        );
        return;
      }
      setResponse(data as ImportResponse);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // Successful import → show the result summary instead of the upload UI.
  if (response) {
    const failed = response.results.filter((r): r is Extract<RowResult, { ok: false }> => !r.ok);
    return (
      <div className="space-y-4">
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-emerald-900">
              {response.created} / {response.total} links created
            </p>
            <p className="text-sm text-emerald-700 mt-0.5">
              {response.failed > 0
                ? `${response.failed} rows failed — see details below. The successful links are now in your Links list.`
                : `All rows succeeded. Head to Links to see them.`}
            </p>
          </div>
        </div>

        {failed.length > 0 && (
          <div className="rounded-lg border border-amber-200 overflow-hidden">
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm font-medium text-amber-900">
              {failed.length} failed rows
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-amber-50/50 text-left text-xs uppercase tracking-wider text-amber-900">
                  <tr>
                    <th className="px-4 py-2">Row</th>
                    <th className="px-4 py-2">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {failed.map((f) => (
                    <tr key={f.row}>
                      <td className="px-4 py-2 font-mono text-xs">{f.row}</td>
                      <td className="px-4 py-2 text-amber-700">{f.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={clearFile}
            className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
          >
            Import another file
          </button>
          <a
            href="/links"
            className="px-4 py-2 bg-[#03A9F4] text-white text-sm font-medium rounded-lg hover:bg-[#0288D1] transition-colors inline-flex items-center"
          >
            Go to Links
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Template download + format hint */}
      <div className="p-4 bg-sky-50 border border-sky-100 rounded-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-sky-900 text-sm">Not sure about the format?</p>
            <p className="text-xs text-sky-800/80 mt-1 leading-relaxed">
              Download the template — it has all supported columns pre-filled with one
              example row. Required: <code className="px-1 py-0.5 bg-white rounded text-sky-900">original_url</code>.
              Everything else is optional.
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-sky-200 rounded-lg text-sm text-sky-700 hover:bg-sky-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download template
          </button>
        </div>
      </div>

      {/* File picker */}
      {!file ? (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="flex flex-col items-center justify-center gap-3 px-6 py-10 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#03A9F4] hover:bg-sky-50/30 transition-colors"
        >
          <Upload className="w-8 h-8 text-slate-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">
              Drop a CSV here, or click to browse
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Max 500 rows per upload</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onInputChange}
          />
        </label>
      ) : (
        <div className="p-4 bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-5 h-5 text-[#03A9F4] shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB
                  {preview && ` · ${preview.length === 5 ? "showing first 5 rows" : `${preview.length} rows`}`}
                </p>
              </div>
            </div>
            <button
              onClick={clearFile}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {parseError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>CSV parse error: {parseError}</span>
            </div>
          )}

          {preview && preview.length > 0 && (
            <div className="mt-3 rounded-lg border border-slate-200 overflow-hidden">
              <div className="overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      {previewHeaders.map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {previewHeaders.map((h) => (
                          <td key={h} className="px-3 py-1.5 text-slate-600 whitespace-nowrap max-w-48 truncate">
                            {row[h] || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {serverError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={submit}
          disabled={!file || submitting || !!parseError}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#03A9F4] text-white text-sm font-medium rounded-lg hover:bg-[#0288D1] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {submitting ? "Importing…" : "Import links"}
        </button>
      </div>
    </div>
  );
}
