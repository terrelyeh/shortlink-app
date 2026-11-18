# 電商促銷 / E-commerce promotion (Amazon Black Friday, Prime Day, store discount)

Goal: drive traffic to product listings / storefront during a short sale window and convert it into orders.

## The thing to get right first: where does the purchase happen?

- **On Amazon** (most common for this team): GA4 can't see Amazon orders. Purchases are measured in Amazon's own reports. If the brand uses **Amazon Attribution**, each channel gets an Attribution tag URL from Amazon Ads — use *that* URL as `original_url` for the matching row, so Amazon credits the sale to the channel. Ask: "有沒有在用 Amazon Attribution？有的話每個通路的 attribution 網址請貼給我。" If not, use the plain listing / storefront URL and say clearly in the plan that sales per channel can't be attributed.
- **On the brand's own shop**: GA4 e-commerce tracking with the same `utm_campaign`.

Still fill the UTM columns even for Amazon destinations — the ShortLink tool uses them to group clicks by channel, and Amazon ignores the extra parameters.

## Extra questions

1. 哪個促銷、哪些國家站（amazon.com / .de / .co.uk / .co.jp…）、促銷起訖時間（用哪個時區）？
2. 導到哪裡：單一商品頁、多個商品頁、還是品牌店面（storefront）？每個國家站的網址？
3. 有沒有 Amazon Attribution？（見上）
4. 通路：EDM（倒數 / 開賣 / 最後機會）、社群貼文、KOL / 部落客、Amazon 站內廣告（Sponsored，通常在 Amazon 後台追蹤，不需要短網址）、合作夥伴
5. 要不要在開賣前就發預告？預告連結是否開賣前先不生效（`starts_at`）？
6. 目標：去年同檔活動的點擊與訂單？

## Channel → UTM mapping

| Piece | medium / source | content |
|---|---|---|
| EDM 預告 / 開賣 / 最後機會 | email / newsletter | `teaser`, `launch_day`, `last_chance` |
| 社群貼文 | social / facebook, instagram, linkedin… | `teaser`, `deal_live`, `last_chance` |
| KOL / 部落客 | influencer / kol_<name> or platform | `review`, `unboxing` |
| 合作夥伴 / 比價網站 | referral / partner_<name> | `deal` |
| 站外付費廣告（Meta、Google） | cpc / facebook, google | `deal_visual_a` |

Multi-country: one row per channel × country, `_us` / `_de` / `_uk` suffix, tag with the country code, each pointing at that country's Amazon site.

Time: sale windows are short and often defined in US time. Write `starts_at` with an explicit offset; confirm whether teaser links should work before the sale (usually yes — they point at the listing anyway).

## Measurement angle

- Clicks per country and channel per day — the window is days, so look **daily, even twice a day** on the main sale days
- Clicks here vs orders in Amazon (Attribution or Business Reports) → rough conversion rate per channel
- Which EDM in the sequence (teaser / launch day / last chance) pulls most
- Cadence: day before (links work, prices live), each sale day morning & evening, D+3 click wrap-up, order wrap-up ≥ 14 days after the sale (Attribution window)

Decision rules to include:
- A country's listing link clicked but Attribution shows no orders by mid-sale → check price / stock / Buy Box on that site
- Last-chance EDM historically strongest → make sure it's scheduled and its link is live
