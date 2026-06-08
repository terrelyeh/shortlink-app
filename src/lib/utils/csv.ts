/**
 * Shared CSV builders for the /api/export/* endpoints.
 *
 * - csvEscape: quote-wrap values containing comma / quote / newline.
 * - buildCsv: header + rows → one string.
 * - csvResponse: NextResponse with download headers + a UTF-8 BOM so
 *   Excel (esp. on Windows) renders Chinese campaign names / titles
 *   correctly instead of mojibake. Browsers / Numbers / Sheets ignore
 *   the BOM, so it's safe everywhere.
 */

import { NextResponse } from "next/server";

type CsvValue = string | number | null | undefined;

export function csvEscape(value: CsvValue): string {
  const s = value == null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(headers: string[], rows: CsvValue[][]): string {
  const head = headers.map(csvEscape).join(",");
  if (rows.length === 0) return head;
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  return `${head}\n${body}`;
}

export function csvResponse(csv: string, filename: string): NextResponse {
  // \uFEFF = UTF-8 byte-order mark. Without it Excel guesses the
  // encoding and garbles non-ASCII (Chinese campaign names / titles).
  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
