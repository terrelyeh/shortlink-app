# 新品上市 / Product launch

Goal of the campaign: make target buyers aware of the product and get them to the product page, then to an enquiry / quote / demo request.

## Extra questions (beyond the core facts in SKILL.md)

1. 上市日（公告日）和活動要追蹤多久？ — default: launch day → +6 weeks
2. 哪些市場、各自的產品頁網址？ — multi-language page is typical
3. 通路與則數 — offer this default and let them strike/add:
   - LinkedIn 自然貼文：發表文 + 追蹤文（每市場）
   - EDM：發表信 + 追蹤信（每市場有名單才發）
   - 新聞稿（referral / pr）
   - Facebook 貼文（若該市場有在經營）
   - Intercom / 既有客戶站內訊息（referral / intercom）
   - 付費：LinkedIn Ads、Google Ads（預設不含，問有沒有預算）
4. 有沒有要比較的素材（兩種主視覺 / 標語）？
5. EDM 會不會提前排程？ — if yes, set `starts_at` = send time on the EDM rows
6. 目標：上一次上市活動總點擊？以及轉換目標（詢價表單數，看 GA4）

## Channel → UTM mapping

| Piece | medium / source | content |
|---|---|---|
| LinkedIn 發表文 / 追蹤文 | social / linkedin | `announce` / `followup` |
| Facebook 發表文 / 追蹤文 | social / facebook | `announce` / `followup` |
| EDM 第一封 / 第二封 | email / mailchimp | `announce` / `followup` |
| 新聞稿 | referral / pr | `press` |
| Intercom | referral / intercom | `app` |
| LinkedIn Ads | cpc / linkedin | `visual_a`, `visual_b` (one link per creative) |
| Google Ads | cpc / google | `search` |

Append `_<market>` when there is more than one market.

## Measurement angle (feeds the plan)

- Primary: total clicks vs goal; split by market and by channel
- Compare: announce vs follow-up (does the second wave earn its effort?), creative A vs B
- Timing: use the 7×24 heatmap after week 1 to schedule the second wave; the decay curve tells how fast a post goes cold
- Downstream: enquiry form submissions in GA4 filtered by the same `utm_campaign`
- Cadence: daily for the first 3 days, then weekly, close at the end date

Typical decision rules to include (adapt numbers to their goal):
- A market below 10% of its share of goal after 3 days → test its links, then review the localized copy
- One channel at ≥2× another → shift the follow-up wave toward it
- Paid: cost per click (spend ÷ clicks here) above the agreed ceiling → pause or swap creative
