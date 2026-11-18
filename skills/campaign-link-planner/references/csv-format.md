# CSV format for the ShortLink "CSV 匯入" page

The importer reads columns **by header name** (case-insensitive, order free). Header names must be exactly these — snake_case. `originalUrl` / `utmSource` style headers are not recognised and the whole file fails.

| Column | Required | Value |
|---|---|---|
| `original_url` | yes | Landing page, must start with `https://` (or `http://`). Do **not** add utm_ parameters yourself — the tool appends them from the UTM columns. |
| `title` | | Human-readable title |
| `custom_code` | | 3–50 chars, `[a-zA-Z0-9_-]`; empty = auto-generated |
| `utm_source` | | |
| `utm_medium` | | |
| `utm_campaign` | | Same value on every row |
| `utm_content` | | |
| `utm_term` | | Usually empty (paid search keywords only) |
| `tags` | | Comma-separated names; created automatically if new |
| `max_clicks` | | Positive integer, usually empty |
| `starts_at` | | ISO 8601 with offset, e.g. `2026-03-03T09:00:00+08:00` — link answers "not yet active" before this |
| `expires_at` | | ISO 8601 with offset — usually empty |
| `allowed_countries` | | Comma-separated ISO-2 codes, usually empty |
| `redirect_type` | | `TEMPORARY` (default) or `PERMANENT` — leave empty |

Write all 14 columns in this order so the file matches the template users can download from the import page:

```
original_url,title,custom_code,utm_source,utm_medium,utm_campaign,utm_content,utm_term,tags,max_clicks,starts_at,expires_at,allowed_countries,redirect_type
```

## Quoting

Standard CSV: wrap a field in double quotes when it contains a comma, a double quote or a newline; double any quote inside. In practice that means `tags` and `allowed_countries` with more than one value (`"US,launch"`), and titles containing commas. UTF-8, no BOM needed. One header row, then one row per link. Max 500 rows.

## Timezone

The team works in Taiwan time. Unless the user gives another timezone, write `+08:00`. For a US-only promo the user may think in US time — ask, and convert to an explicit offset (`-05:00` for US Eastern in winter, `-08:00` Pacific in winter, `-04:00` / `-07:00` in summer).

## When to use `starts_at`

Only when a link must not work before a date — e.g. an EDM scheduled ahead of a launch, or a promo page that 404s before the sale. Don't set it for links that go out the same day they are created.

## Self-check before handing over (if you can't run the validator)

1. Header line is exactly the 14 names above.
2. Every `original_url` starts with `http` and contains no `utm_`.
3. `utm_campaign` identical on every row, matching `^[a-z0-9_]+$`.
4. Every `utm_medium` is in the fixed list (see utm-rules.md).
5. `(utm_source, utm_medium, utm_content)` unique per row.
6. `custom_code` either empty or `^[a-zA-Z0-9_-]{3,50}$`, and unique in the file.
7. Fields with commas are quoted; row count ≤ 500.
