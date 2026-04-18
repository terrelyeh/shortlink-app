import { ChevronLeft, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import CSVImportClient from "./CSVImportClient";

export function generateMetadata() {
  return { title: "Import Links from CSV" };
}

export default function CSVImportPage() {
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
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-100)" }}>
              Import links from CSV
            </div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-400)", margin: "0 0 16px" }}>
          Upload a CSV with one row per link — each can have its own URL, UTM set, tags,
          expiry and custom code. Great for rolling out 20+ channel variants in one go.
        </p>
        <CSVImportClient />
      </div>
    </div>
  );
}
