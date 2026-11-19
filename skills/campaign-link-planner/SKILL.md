---
name: campaign-link-planner
description: Plans the tracked short links for a marketing campaign through a short Q&A, then outputs (1) a CSV ready for the "CSV 匯入" page of the EnGenius ShortLink tool (go.engenius.ai) and (2) a one-page Markdown measurement plan (成效衡量計畫). Covers product launches (新品上市), trade shows / exhibitions (展會, e.g. Computex, Interop), and e-commerce promotions (電商促銷, e.g. Amazon Black Friday / Prime Day), including multi-country, multi-language landing pages. Use this whenever a marketer wants to plan, set up or prepare links, UTMs, QR codes or tracking for an upcoming campaign, launch, event, show or sale — even if they only say things like "幫我規劃活動連結", "要準備黑五的追蹤連結", "下個月展會要印 QR", "新品上市要發哪些貼文/EDM", or "我要建一整套 UTM".
---

# Campaign Link Planner

Turn a marketer's campaign idea into two things they can use immediately:

1. **`<campaign>_links.csv`** — one row per tracked link, in the exact format the ShortLink tool's **CSV 匯入** page accepts. They upload it and every link is created in one go.
2. **`<campaign>_plan.md`** — a one-page 成效衡量計畫: goal, what to look at when, decision rules, and how to report at the end.

The people using this are marketers, not engineers. Talk to them in their language (default 繁體中文), keep jargon to a minimum, and never make them type UTM values by hand — deciding those values consistently is the whole point of this skill.

## Why this matters

Clicks are only comparable if every link in a campaign shares the same `utm_campaign` and each channel / creative / market has a distinct, predictable combination of `utm_source` / `utm_medium` / `utm_content`. One typo (`Spring-Sale` vs `spring_sale`) splits the report in two, and the ShortLink tool and GA4 can only be lined up when the campaign name is identical in both. The Q&A exists to collect facts; the naming is your job.

## Workflow

### Step 1 — Find out what kind of campaign this is

If the user's first message doesn't make it obvious, ask. Then read the matching reference file before asking anything else — it holds the questions, default channels and the measurement angle for that type:

| Type | Read |
|---|---|
| 新品上市 / product launch | `references/type-product-launch.md` |
| 展會 / trade show / conference / booth | `references/type-exhibition.md` |
| 電商促銷 / Amazon, Black Friday, Prime Day, discount sale | `references/type-ecommerce-promo.md` |

If it is a mix (e.g. a launch announced at a show), use the type that drives most of the links and borrow channels from the other.

### Step 2 — Collect the facts in at most three rounds

Ask in small batches (3–4 questions per message), each with a suggested default the user can accept by just saying "ok" / "照預設". Skip anything the user already told you. If they paste a long brief, extract what you can and only ask for the gaps.

Core facts every campaign needs (the type file adds its own):

- Product / event name and dates (start, end; for promos the exact sale window). **Check every date against today.** People often write "3/3" or "6/2" without a year; if a date would land in the past, ask which year they mean before naming anything — the year goes into the campaign name and `starts_at`, so guessing wrong means re-importing.
- Is this a new campaign or more links for one that already exists in the tool? If it exists, reuse its exact `utm_campaign` (even if it predates the underscore convention, e.g. `computex-26`) — a new spelling would split the report in two.
- Markets and their landing pages. **Multi-language is common**: the same page in several languages (e.g. `/en/`, `/de/`, `/ja/`). Ask for one URL per market, or one URL plus the language pattern and generate the rest — then show the list back so they can catch a wrong path.
- Channels and how many pieces per channel (e.g. LinkedIn 2 posts, EDM 2 sends, booth posters 4)
- Creatives to compare (two key visuals, two headlines) — these become separate links
- Goal: last similar campaign's clicks if they know it; otherwise you propose one and mark it 待校正

Do not invent landing URLs. If a market's URL is unknown, put a clearly fake placeholder (`https://TODO-<market>-url`) and say so — the import will reject it, which is better than silently sending traffic to the wrong page.

### Step 3 — Build the link plan

Apply the naming rules in `references/utm-rules.md` (campaign name, mediums, sources, content, market suffix, custom codes, titles, tags). One link per **channel × piece × creative × market** that the user will actually publish separately — if two posts will never be told apart in a report, they can share a link; if they will, they must not.

### Step 4 — Show the plan and get a yes

Before writing any file, show a compact table: title, market, medium / source, content, custom code, destination. Plus the campaign name and the total count. Ask "這樣可以嗎？要調整哪幾列？" and apply edits. This is the cheapest moment to catch a wrong URL.

### Step 5 — Produce the two outputs

- **CSV**: follow `references/csv-format.md` exactly (column names, quoting, datetimes). If you can run Python, validate with `python scripts/validate_links_csv.py <file>` and fix anything it reports. If you can't, walk the checklist at the end of `csv-format.md` yourself.
- **Plan**: fill `references/plan-template.md`. Keep it to one page — it is a checklist people act on, not a report.

Save them as files when you can (`<campaign>_links.csv`, `<campaign>_plan.md`). If you can't write files in this environment, print each in its own fenced code block (```csv / ```markdown) so the user can copy them.

### Step 6 — Hand-off message

End with three short lines: how to import (連結管理 → 建立新連結旁的 ▾ → CSV 匯入 → 上傳 → 預覽 → 匯入), that a row which fails (e.g. custom code already taken) is skipped and the rest still import, and what to do right after: on the campaign page set the period, the owner (負責人) and the per-channel goals from plan section 2, then test each link with 「測試短網址」. Links with a `starts_at` show 「尚未啟用」 until that time, so say to test those right after they go live rather than at import.

## What the tool can and can't do (so you don't promise the wrong thing)

- It counts **clicks before the landing page**. Sign-ups, enquiries and purchases are measured elsewhere — GA4 for own sites (filter by the same `utm_campaign`), Amazon's reports / Amazon Attribution for Amazon.
- It does not know impressions or ad spend; CTR and cost per click need numbers from the ad platforms.
- Bots and social preview crawlers are not counted; suspected corporate email-scanner clicks (outdated-Chromium user agents) are flagged and excluded automatically; clicks opened via 「測試短網址」 are marked as tests and excluded. A 「含測試與疑似機器點擊」 toggle on the analytics and campaign pages adds them back.
- Analytics keep about two years of clicks. Once a campaign has a period (start/end date), the campaign list and page default to that period (all time otherwise), and status (即將開始 / 進行中 / 已結束) follows the dates.
- Goals can be set per channel (utm_medium); each gets a progress bar with a pace line for running campaigns. Each campaign can have one owner (負責人) for KPI tracking.
- The tool has its own guided 活動啟動器 (行銷活動 → 活動啟動器) that builds a simple single-market exhibition or product launch in the browser with the same naming rules. Point users there when that's all they need; this skill is for multi-market or e-commerce campaigns, or when planning from a long brief.
- Share reports freeze the date range when generated — good for sending to a manager.
- This skill cannot see existing campaigns or links. Custom codes are global in the tool, so a clash is possible; the import reports it per row.

## Measurement traps worth putting in the plan when they apply

These are the things that make numbers look wrong later. Include only the ones relevant to this campaign's channels, in the plan's 注意事項:

- **EDM**: corporate mail security scanners click every link within minutes of sending (common with B2B lists). The tool now excludes most of them automatically (「疑似郵件掃描點擊」), so EDM numbers are lower than older campaigns' — compare with past campaigns as they show today, not with numbers someone wrote down before. Still judge emails over 24–48 h, not the first hour.
- **Trade shows**: visitors share the venue Wi-Fi, so 不重複訪客 undercounts badly — use total clicks per QR position. Print QR at roughly scan distance ÷ 10 (standee viewed from 3 m → ~30 cm; name card ≥ 2 cm) and print the short URL under it for people who can't scan.
- **Booking / form tools** (Calendly, HubSpot forms): they usually keep the UTM parameters, so bookings can be traced back to the exact QR or post — say where to look.
- **Instagram**: captions can't hold clickable links; the link goes in a Story link sticker or the bio. Don't plan an IG link as if it were a normal post link.
- **Amazon**: Attribution keeps crediting orders for 14 days after a click, so set the final order wrap-up ≥ 14 days after the sale ends. Deals on amazon.de / .co.uk usually follow local time even when the US window is in Eastern time — confirm each site's window.
- **Comparisons with last year**: compare like with like (same channels, same window); a new channel this year is upside, not part of the baseline.
