# 展會 / Trade show, conference, booth

Goal: get the right visitors to the booth (pre-show), capture interest on site (QR), and follow up after the show.

## Extra questions

1. 展會名稱、地點、展期（開始/結束日）？
2. 展前宣傳：有沒有 save-the-date / 邀請 EDM、LinkedIn 展前預告？各幾則？
3. **現場 QR**：要印幾種、放在哪裡、各自導去哪？ — QR on show floors often points to *different* places per position (product page, demo booking such as Calendly, LinkedIn company page, catalogue PDF). Ask for each one's destination and location (攤位正面 / Demo 區 / 型錄 / 名片).
4. 展後追蹤：展後感謝 / follow-up EDM？LinkedIn 展後回顧文？
5. 有沒有發給代理商 / 合作夥伴的邀請連結（每家各一條）？
6. 目標：上一屆同展的掃描數或點擊數？名單目標（看 CRM / GA4）？

## Channel → UTM mapping

| Piece | medium / source | content |
|---|---|---|
| 展前邀請 EDM | email / newsletter | `save_the_date`, `reminder` |
| LinkedIn 展前預告 | social / linkedin | `teaser`, `booth_tease` |
| 攤位海報 QR | qr / poster | position: `booth_front`, `booth_demo`, `hall_entrance` |
| 型錄 / DM 上的 QR | qr / flyer | `brochure` |
| 名片 QR | qr / namecard | `staff` (or per person if they want to compare) |
| 代理商邀請 | referral / partner_<name> | `invite` |
| 展後 EDM | email / newsletter | `post_event` |
| LinkedIn 展後回顧 | social / linkedin | `recap` |

Printed QR rules: never set `expires_at` (posters get reused and photographed); custom codes should be short and readable because people sometimes type them; one link per physical position so you learn which spot works. Ask whether last year's number was per QR or all QR combined before using it as a baseline.

If the show is in another country, the landing pages may be in that language — same multi-language handling as other types.

## Measurement angle

- During the show: scans per day and per QR position (campaign page → 連結 tab); city ranking confirms the scans come from the venue city
- Before vs after: pre-show channels drive booth visits — compare their clicks in the 2 weeks before opening
- After: post-show EDM click-through within 7 days; the decay curve shows how fast interest fades
- Downstream: booth leads / demo bookings come from CRM or the booking tool, not this tool
- Cadence: daily during the show (end of each day — move a poster that isn't scanned), then D+7 and D+14 after

Decision rules to include:
- A poster position with near-zero scans by midday of day 1 → move it or change its call-to-action
- Most scans going to one destination (e.g. demo booking) → bring that QR to the front
