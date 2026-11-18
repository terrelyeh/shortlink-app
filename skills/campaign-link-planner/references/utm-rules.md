# Naming rules for links in one campaign

These match the ShortLink tool's built-in UTM lists and the team's UTM 使用指南. Consistency beats cleverness: someone filtering a report six months from now must be able to guess the values.

## utm_campaign — one value for the whole campaign

- Lowercase letters, digits and `_` only. No spaces, hyphens, Chinese or capitals (the tool lowercases and strips other characters anyway; generate the clean form yourself so what the user approves is what gets stored).
- Pattern `{topic}_{period}` or `{topic}_{period}_{audience}`:
  - launch: `wifi7ap_launch_2026q1`
  - show: `computex_2026`, `interop_tokyo_2026`
  - promo: `blackfriday_2026_us` only if each country is run as a separate campaign; otherwise `blackfriday_2026`
- **All markets share one campaign** unless the user says the countries are separate campaigns with separate budgets/owners. Markets are told apart by tag and content suffix (below).
- Same value must be used in GA4 / ad platforms — say so in the plan.

## utm_medium — channel type, from this fixed list only

`cpc` · `social` · `organic` · `email` · `referral` · `affiliate` · `display` · `video` · `qr` · `offline` · `influencer`

| What the user says | medium |
|---|---|
| organic LinkedIn / FB / IG / Threads post | `social` |
| paid ads (LinkedIn Ads, Google Ads, Meta Ads, Amazon Sponsored) | `cpc` (banner-style placements: `display`) |
| EDM, newsletter | `email` |
| press release, partner site, distributor page, Intercom/in-app | `referral` |
| affiliate / reseller with commission | `affiliate` |
| QR on poster, flyer, standee, packaging, name card | `qr` |
| KOL / creator content | `influencer` |

## utm_source — the specific platform / place

Prefer the tool's built-in values so dropdowns and whitelists match:

- social / cpc / display: `linkedin`, `facebook`, `instagram`, `threads`, `x`, `youtube`, `line`, `google`, `bing`, `amazon`
- email: `newsletter` (or the platform: `hubspot`, `mailchimp`)
- referral: `pr` (press release), `partner` or `partner_<name>`, `distributor`, `website`, `intercom`
- qr: `poster`, `flyer`, `standee`, `packaging`, `namecard`, `event`
- influencer: the platform, or `kol_<name>` when tracking named creators

Lowercase, underscores only.

## utm_content — which piece / creative / position

Describes what makes this link different from its siblings within the same source+medium:

- sequence / purpose: `announce`, `followup`, `reminder`, `save_the_date`, `post_event`, `teaser`, `launch_day`, `last_chance`
- creative: `visual_a` / `visual_b`, `video_30s`, `carousel`
- placement (shows): `booth_front`, `booth_demo`, `hall_entrance`, `brochure`

**Multi-market**: append the market code as the last part: `announce_us`, `announce_de`. Use ISO country codes lowercase (`us`, `de`, `jp`, `uk`, `fr`, `tw`). If the market is a language rather than a country (one page serving all Spanish speakers) use the language code (`es`).

Every row in the CSV must have a unique `(utm_source, utm_medium, utm_content)` triple — otherwise two links are indistinguishable in reports.

## custom_code — the readable short URL path

Optional but recommended: people paste these into posts and print them on posters, and a readable code is easier to check.

- 3–50 characters, only `a–z 0–9 - _` (use lowercase with hyphens for readability)
- Pattern `{short-campaign}-{channel}-{piece}[-{market}]`, e.g. `w7ap-li-1-de`, `cx26-poster-front`, `bf26-amz-us`
- Must be unique within the file. Codes are global in the tool, so prefer something specific to this campaign over generic words like `launch` or `promo`.
- Leave empty if the user prefers random codes.

## title — what humans see in the link list

`{Channel} — {piece}（{MARKET}）`, e.g. `LinkedIn — 發表文（DE）`, `展攤海報 — 正面`, `Amazon 店面 — 黑五（US）`. Write it in the user's language. Keep under ~60 characters.

## tags — filters in the tool

Comma-separated. Always include the market code in capitals when there is more than one market (`US`, `DE`). Optionally one campaign-wide tag (e.g. `computex2026`) — but don't duplicate the campaign name endlessly; the campaign filter already does that.

## Things to leave alone unless asked

- `allowed_countries`: geo-blocking also blocks travellers and some social crawlers. Only set it if the user explicitly wants a market-only link.
- `redirect_type`: keep `TEMPORARY` (302). `PERMANENT` gets cached by browsers, so later destination changes won't apply and repeat clicks aren't counted.
- `max_clicks`, `expires_at`: only for genuinely limited offers. Printed QR codes should never expire.
