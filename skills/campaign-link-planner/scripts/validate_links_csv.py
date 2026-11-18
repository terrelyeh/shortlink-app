#!/usr/bin/env python3
"""Check a links CSV against the EnGenius ShortLink "CSV 匯入" format.

Usage:  python validate_links_csv.py <file.csv>
Exit 0 = OK (warnings may still print), 1 = errors found.
Standard library only, so it runs in any agent sandbox with Python 3.
"""
import csv
import re
import sys
from datetime import datetime

COLUMNS = [
    "original_url", "title", "custom_code", "utm_source", "utm_medium",
    "utm_campaign", "utm_content", "utm_term", "tags", "max_clicks",
    "starts_at", "expires_at", "allowed_countries", "redirect_type",
]
MEDIUMS = {"cpc", "social", "organic", "email", "referral", "affiliate",
           "display", "video", "qr", "offline", "influencer"}
CAMPAIGN_RE = re.compile(r"^[a-z0-9_]+$")
VALUE_RE = re.compile(r"^[a-z0-9_+-]+$")  # what the tool's sanitizer keeps
CODE_RE = re.compile(r"^[a-zA-Z0-9_-]{3,50}$")
COUNTRY_RE = re.compile(r"^[A-Z]{2}$")
MAX_ROWS = 500


def parse_iso(v):
    try:
        return datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return None


def main(path):
    errors, warnings = [], []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        try:
            header = next(reader)
        except StopIteration:
            print("ERROR: file is empty")
            return 1
        rows = [r for r in reader if any(c.strip() for c in r)]

    norm = [h.strip().lower() for h in header]
    if norm != COLUMNS:
        missing = [c for c in COLUMNS if c not in norm]
        unknown = [h for h in norm if h not in COLUMNS]
        if "original_url" not in norm:
            errors.append("header has no 'original_url' column — the import would fail entirely")
        if missing:
            warnings.append(f"header missing columns (allowed, but template has them): {missing}")
        if unknown:
            errors.append(f"unknown header names (ignored by the importer — likely camelCase?): {unknown}")
    idx = {h: i for i, h in enumerate(norm)}

    def get(row, col):
        i = idx.get(col)
        return row[i].strip() if i is not None and i < len(row) else ""

    if len(rows) == 0:
        errors.append("no data rows")
    if len(rows) > MAX_ROWS:
        errors.append(f"{len(rows)} rows — the importer accepts at most {MAX_ROWS}")

    campaigns, triples, codes = set(), {}, {}
    for n, row in enumerate(rows, start=2):
        if len(row) != len(header):
            errors.append(f"row {n}: {len(row)} fields but header has {len(header)} (unquoted comma?)")
        url = get(row, "original_url")
        if not re.match(r"^https?://\S+$", url):
            errors.append(f"row {n}: original_url not a http(s) URL: {url!r}")
        elif "utm_" in url:
            warnings.append(f"row {n}: original_url already contains utm_ params — the tool adds them from the UTM columns")
        if "TODO" in url:
            warnings.append(f"row {n}: placeholder URL still present")

        camp = get(row, "utm_campaign")
        campaigns.add(camp)
        if camp and not CAMPAIGN_RE.match(camp):
            errors.append(f"row {n}: utm_campaign {camp!r} must be lowercase letters/digits/underscore")
        med = get(row, "utm_medium")
        if med and med not in MEDIUMS:
            errors.append(f"row {n}: utm_medium {med!r} not in {sorted(MEDIUMS)}")
        for col in ("utm_source", "utm_content", "utm_term"):
            v = get(row, col)
            if v and not VALUE_RE.match(v):
                errors.append(f"row {n}: {col} {v!r} should be lowercase with _ only")

        triple = (get(row, "utm_source"), med, get(row, "utm_content"))
        if triple in triples:
            errors.append(f"row {n}: same source/medium/content as row {triples[triple]} — indistinguishable in reports")
        triples.setdefault(triple, n)

        code = get(row, "custom_code")
        if code:
            if not CODE_RE.match(code):
                errors.append(f"row {n}: custom_code {code!r} must be 3-50 chars of a-z 0-9 - _")
            elif code.lower() in codes:
                errors.append(f"row {n}: custom_code {code!r} duplicates row {codes[code.lower()]}")
            codes.setdefault(code.lower(), n)

        for col in ("starts_at", "expires_at"):
            v = get(row, col)
            if v:
                d = parse_iso(v)
                if d is None:
                    errors.append(f"row {n}: {col} {v!r} is not ISO 8601")
                elif d.tzinfo is None:
                    warnings.append(f"row {n}: {col} has no timezone offset — server will read it as UTC")
        mc = get(row, "max_clicks")
        if mc and not (mc.isdigit() and int(mc) > 0):
            errors.append(f"row {n}: max_clicks must be a positive integer")
        ac = get(row, "allowed_countries")
        if ac:
            bad = [c for c in (x.strip().upper() for x in ac.split(",")) if c and not COUNTRY_RE.match(c)]
            if bad:
                errors.append(f"row {n}: allowed_countries has invalid codes {bad}")
        rt = get(row, "redirect_type")
        if rt and rt.upper() not in ("TEMPORARY", "PERMANENT"):
            errors.append(f"row {n}: redirect_type must be TEMPORARY or PERMANENT")
        if rt.upper() == "PERMANENT":
            warnings.append(f"row {n}: PERMANENT (301) is cached by browsers — later destination changes won't apply")

    campaigns.discard("")
    if len(campaigns) > 1:
        errors.append(f"more than one utm_campaign in the file: {sorted(campaigns)}")
    if not campaigns and rows:
        warnings.append("no utm_campaign set — links won't group into a campaign")

    for w in warnings:
        print("WARN :", w)
    for e in errors:
        print("ERROR:", e)
    print(f"{len(rows)} rows, {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
