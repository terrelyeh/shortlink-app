# CLAUDE.md — Project Context

> Last updated: 2026-05-06 — DB-driven auth + custom domain + Kickstart wizard + mobile baseline

## Project Overview

行銷部專用短網址 + UTM 追蹤工具。團隊建連結、共用 UTM 規範、看點擊分析。
功能清單與產品定位詳見 [README.md](README.md)。

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + TypeScript (strict)
- **Prisma 6** ORM → **PostgreSQL** via **Supabase** (ap-northeast-1)
- **NextAuth.js v5** (Google OAuth) + `@auth/prisma-adapter`
- **@tanstack/react-query v5** — client-side data cache（所有 dashboard 頁面都走這條）
- **Upstash Redis**（選配快取，有 graceful fallback）
- Tailwind CSS 4、Recharts、next-intl、Zod、lucide-react
- **Inter**（UI）+ **JetBrains Mono**（資料 / URL / campaign 名稱）
- 部署：**Vercel** (Hobby plan) — GitHub 自動部署

## Directory Structure

```
src/
├── app/
│   ├── layout.tsx                  # ⭐ Root layout：<html>/<body> + fonts
│   │                               #    （非 locale 頁如 /link-*、/share 也要用）
│   ├── [locale]/
│   │   ├── layout.tsx              # Locale 專用：NextIntlClientProvider（無 html/body）
│   │   ├── (dashboard)/            # Route group（不是 /dashboard 路徑）
│   │   │   ├── campaigns/
│   │   │   │   ├── page.tsx        # 登入首頁、Leaderboard
│   │   │   │   ├── CampaignsClient.tsx
│   │   │   │   ├── [name]/page.tsx # 單活動駕駛艙（Overview / Traffic / Links tabs）
│   │   │   │   ├── compare/        # /campaigns/compare?names=a,b,c
│   │   │   │   └── kickstart/      # Wizard：選 playbook 一鍵建整套追蹤連結
│   │   │   ├── links/
│   │   │   │   ├── page.tsx + LinksClient.tsx
│   │   │   │   ├── [id]/           # 編輯
│   │   │   │   ├── new/ batch/ import/ # import 是 CSV 匯入
│   │   │   │   └── ...
│   │   │   ├── analytics/          # 純全站維度分析（砍了 campaign leaderboard）
│   │   │   ├── settings/           # 含 UTM Governance tab
│   │   │   └── audit-log/          # （/users 已砍，僅留 audit-log）
│   │   ├── invite/[token]/
│   │   │   ├── page.tsx            # 受邀者落地頁（讀邀請、accept、auto-redirect）
│   │   │   └── layout.tsx          # 必須：包 SessionProvider（locale layout 沒包）
│   │   └── page.tsx                # 根頁 → 登入時 redirect 到 /campaigns
│   ├── auth/signin/                # NextAuth pages
│   ├── api/
│   │   ├── analytics/
│   │   │   ├── route.ts            # 已聚合（留給 export/share）
│   │   │   ├── raw/route.ts        # raw clicks，給 client-side compute
│   │   │   └── campaigns-summary/  # Leaderboard + per-campaign 時序資料
│   │   ├── track/route.ts          # 🎯 公開 conversion tracking endpoint（CORS *）
│   │   ├── links/
│   │   │   ├── route.ts + [id]/    # CRUD
│   │   │   ├── batch/ batch-csv/   # 批次建立（CSV 是每 row 獨立 UTM）
│   │   │   └── batch-actions/ clone/...
│   │   └── {campaigns, tags, templates, workspace, ...}
│   ├── s/[code]/route.ts           # 短網址轉址 + variant pick + session 附 ?_sl=
│   ├── share/[token]/              # 公開分享報告（sharetoken 驗證）
│   ├── track.js/route.ts           # 🎯 公開 JS snippet（landing 端引用）
│   ├── link-expired/ link-inactive/ link-limit-reached/
│   │   link-not-yet-active/ link-geo-blocked/  # 狀態頁
│   └── ...
├── components/
│   ├── analytics/
│   │   ├── ClicksChart.tsx PieChartComponent.tsx
│   │   ├── MultiCampaignChart.tsx  # overlay 折線（P0 + Compare 頁共用）
│   │   └── TrendCell.tsx           # 迷你 sparkline + ↑↓% 狀態，Campaign Detail / Leaderboard 共用
│   ├── layout/
│   │   ├── Sidebar.tsx PageHeader.tsx
│   │   └── SyncButton.tsx          # 每頁 header 右上角的「同步 + 最後同步時間」
│   ├── forms/UTMBuilder.tsx        # 含 CampaignCombobox（自訂 Linear/Slack-style，可 inline 建活動）
│   ├── links/
│   │   ├── LinkTableRow.tsx        # 桌面表格列（含 OG 縮圖 + schedule/geo badges）
│   │   └── LinkMobileCard.tsx      # ≤768px 用的 card 版本（useMediaQuery 切換）
│   ├── providers/Providers.tsx     # SessionProvider + QueryClientProvider + WorkspaceProvider + Toast
│   │                               # （注意：dashboard 之外的頁要自己包 SessionProvider）
│   └── ...
├── lib/
│   ├── analytics/compute.ts        # ⭐ Client-side 聚合（純 JS）
│   ├── cache.ts / cache-scopes.ts  # Redis wrapper + bumpLinksCache 等 helper
│   ├── query/client.ts             # React Query QueryClient 設定
│   ├── ratelimit.ts                # Upstash ratelimit（redirect + /api/track）
│   ├── auth.ts                     # NextAuth + DB-driven invitation gate + auto-accept hook
│   ├── workspace.ts                # resolveWorkspaceScope（auto-fallback）+ canUserActOnResource
│   ├── fetch-workspace.ts          # ⭐ patch window.fetch 自動塞 x-workspace-id header
│   ├── hooks/useMediaQuery.ts      # SSR-safe matchMedia hook（mobile 切換用）
│   ├── og-scraper.ts utm-governance.ts variants.ts campaign-autolink.ts
│   ├── campaign-playbooks.ts       # Kickstart wizard 的 playbook 定義（Product Launch / Exhibition）
│   └── utils/{utm,shortcode,format}.ts
├── messages/{en,zh-TW}.json        # 雙語文件；每新增使用者可見字串就兩邊都要加
└── middleware.ts                   # next-intl routing + 短域名守護（rewrite /<code> → /s/<code>）
prisma/schema.prisma                # 含 @@index — FK 索引不自動建
scripts/
├── backfill-campaign-autolink.mjs  # 一次性 orphan link → Campaign 綁定
└── backfill-workspace-id.mjs       # 補回 workspaceId=null 的 ShortLink/Campaign/UTMTemplate/Click
```

## Architecture & Data Flow

### 1. Route A — Campaign-centric navigation（心智模型）

Sidebar 順序 = 使用者心智模型（高頻→低頻）：
**Campaigns → Links → Analytics → Templates → Users / Audit Log**

登入導向 **`/campaigns`**（Dashboard 已刪）。三頁各自職責：

- **Campaigns 列表** = 活動管理駕駛艙。Leaderboard（clicks / conv / CVR / goal%），勾選 2-4 個 → overlay 折線 / `/campaigns/compare` side-by-side
- **Campaign Detail**（`/campaigns/[name]`）= 單活動「指揮中心」，3 tabs：
  - **Overview** — KPI 目標 + 30d 趨勢折線
  - **Traffic** — top sources / mediums / devices / countries / referrers（透過 `computeAnalytics(raw, { campaign })` 過濾）
  - **Links** — 該活動的所有連結 + 每條 conversion / CVR
- **Analytics** = 純「全站維度分析」（device / browser / OS / geo / referrer / UTM 交叉表）。**沒有** campaign leaderboard — 那是 Campaigns 的事

### 2. Conversion attribution（`/api/track` + `/track.js`）

```
/s/<code> redirect ─┐
                    │ 1. 伺服器生成 16-char sessionId
                    │ 2. 附到目的 URL: ?_sl=<sid>
                    │ 3. Click row 寫入 sessionId + variantId
                    ▼
Landing page (任何 domain)
  <script src="https://mkt-shortlink.../track.js" async>
  ↓ snippet 從 URL 讀 _sl、存 sessionStorage、清掉 address bar
  ↓ window.Shortlink.convert({ event, value, currency, externalId })
  ↓ POST /api/track { sessionId, eventName, value, currency, externalId, metadata }
  ▼
/api/track
  ↓ 找 Click by sessionId（30 天 attribution window）
  ↓ 寫入 Conversion（unique on shortLinkId+externalId 做 idempotency）
  ↓ Conversion.variantId 從 Click 複製 → A/B breakdown 不用 join
```

**關鍵**：sessionId 走 URL param 不走 cookie，跨任何 domain 都能歸因。

### 3. A/B 變體

- `ShortLink.variants: Json`（`{id, url, weight, label?}[]`）
- `lib/variants.ts` — `parseVariants()` + `pickVariant()` weighted random
- 轉址路徑：variants 空 → 用 `originalUrl`；有 → weighted pick + `Click.variantId` 記錄
- Edit form 有 variant editor（label + URL + weight + 即時百分比）

### 4. Campaign auto-link

使用者填 `utmCampaign = "spring_sale"` → `lib/campaign-autolink.ts` 在 POST/PATCH/batch-csv 都自動 upsert Campaign row（`status=ACTIVE`）+ 設 `ShortLink.campaignId`。解掉「我填了 UTM 為什麼 Campaigns 頁空的」認知 gap（Bitly / Dub.co pattern）。Backfill script：`scripts/backfill-campaign-autolink.mjs`。

### 5. Client-side Data Caching (React Query) ⭐

**整個 dashboard 的資料都走 React Query。** 切換頁面瞬間完成（讀 in-memory cache），不再每次 mount 都打 API。架構：

```
使用者切頁 → useQuery(key) → 5 min 內命中 cache，零網路
                          → 超過 staleTime → 背景重抓，同時先秀舊資料
Mutation 完成 → qc.invalidateQueries({ queryKey }) → 相關頁下次進去才抓新資料
SyncButton click → qc.invalidateQueries(pageKeys) → 強制重抓當頁
```

**共用 query keys（重要：保持一致才能跨頁共用 cache）**：

| Key | 內容 | 使用頁 |
|---|---|---|
| `["analytics-raw"]` | 90d × 10k 筆 raw clicks（~2MB） | `/analytics`、Campaign Detail、Compare |
| `["campaigns-summary", window]` | leaderboard / 時序 / orphans | `/campaigns`、Compare |
| `["links", 500]` | 連結列表（含 trend） | `/links` |
| `["campaign-links", name]` | 某活動下的 links | Campaign Detail |
| `["campaign-goal", name]` | 該活動的 goalClicks | Campaign Detail |
| `["tags"]` / `["templates"]` / `["workspace-utm-settings"]` / `["utm-campaigns"]` | 共用資源 | 多處 |

**`QueryClient` 預設值**（`lib/query/client.ts`）：
- `staleTime: 5 min`、`gcTime: 30 min`
- `refetchOnWindowFocus / refetchOnMount / refetchOnReconnect: false`（**全關**，避免偷偷重抓）
- `retry: 1`

**Mutation 後要 invalidate 什麼**（在 CreateLinkForm、LinksClient、edit page、goal save 都有處理）：
- 建 / 改 / 刪 link → `campaigns-summary` + `analytics-raw` + `campaign-links` + `utm-campaigns`
- 改 goalClicks → `campaign-goal/{name}` + `campaigns-summary`
- 新建 Campaign（combobox inline create）→ `utm-campaigns` + `campaigns-summary`

**SyncButton** — 每頁 header 右側，接收 `queryKeys` prop（該頁依賴的 keys 陣列）。旁邊秀「Last synced Nm ago」從 `queryState.dataUpdatedAt` 推導。點了只 invalidate 該頁，不會干擾其他頁的 cache。

⚠️ **Cache key shape 變動時要 bump 版本號** — 如果 API payload 新增欄位，舊 Redis cache 會讓 client 讀到沒有新欄位的物件、直接 crash。看 `campaigns-summary-v2` 那一段註解。

### 6. 兩層 cache：Server (Redis) + Client (React Query)

```
Request → React Query in-memory (5min stale) → Browser Cache-Control → Redis (60s TTL) → Postgres
```

- **Client React Query**：切頁瞬間、無網路
- **Browser Cache-Control**：同頁 refresh 時省掉 cold fetch
- **Redis**（`lib/cache.ts`，無 env vars 自動 no-op）：
  - 有 Redis cache 的 endpoint：`/api/analytics`、`/api/analytics/raw`、`/api/analytics/campaigns-summary`、`/api/links`（versioned）
  - `/api/links` 用 versioned key：寫入時 `bumpLinksCache(workspaceId, userId)` 讓版本號 +1，舊 key 自動失效
  - Invalidation 入口集中在 `lib/cache-scopes.ts`

**Caps**：`/links` 500 條、`/analytics/raw` 10,000 clicks × 90 天，超過顯示 banner（前端 `raw.meta.truncated`）。

### 6b. 列表頁做「client-side filter」

`/links`、`/campaigns`、`/analytics` 都是抓一次完整資料，client 用 `useMemo` 過濾 / 排序 / 聚合 — 切 filter 零網路。結合上面的 React Query cache，就是「打 1 次 API、後續無限互動零延遲」。

### 7. Auth + Workspace（DB-driven）

整個 user management 已從 env-var 白名單 → 移到 DB。`ALLOWED_EMAILS` 還在但只當過渡 fallback，正式規則在 `lib/auth.ts` signIn callback：

```
signIn 允許條件（first-match-wins）：
  1. BOOTSTRAP_EMAILS env（1–2 個緊急 admin，緊急開機用）
  2. WorkspaceMember 存在     → 既有成員
  3. PENDING WorkspaceInvitation + 未過期 → 被邀請的新人
  4. ALLOWED_EMAILS env       → 過渡相容，等所有人都正式邀請進來後可刪
```

**`events.signIn` 自動 accept**：使用者首次 OAuth 成功後，hook 找出該 email 所有 PENDING invitation 一次 accept，建好 WorkspaceMember。所以**口頭通知 + 直接登入** 跟 **點 invite link** 兩條路效果一樣 — 連結只是便利性。

**Permission helper — 用 `canUserActOnResource`**（`lib/workspace.ts`）：
```
canUserActOnResource(userId, { createdById, workspaceId }) → boolean
  - 是建立者 → 永遠 yes
  - 在 resource workspace 是 OWNER/ADMIN → yes（admin override）
  - 其他 → no
  - workspaceId=NULL 的 orphan → 只有建立者能動
```
**所有 API 的權限檢查都用這個。** 不要再寫 `session.user.role === "MEMBER"` 那種舊 pattern — `User.role` 是 legacy 全域旗標，跟 workspace 角色完全脫鉤，現在只剩 `/audit-log` sidebar gating 還在用。

**`resolveWorkspaceScope` 的 auto-fallback**：client 沒送 `x-workspace-id` header（race condition：fetch 在 WorkspaceContext 載入前就發出）時，server 自動查使用者最早加入的 workspace 補上，不再產生 `workspaceId=NULL` 的 orphan。配合下面的 fetch patch 兩道防線。

**Client 端 `lib/fetch-workspace.ts`**：在 `Providers.tsx` 模組載入時 patch `window.fetch`，對同站 `/api/*`（略過 `/api/auth/*`）自動塞 `x-workspace-id` header（從 localStorage 讀 `shortlink-current-workspace`）。Workspace 切換時下個 request 自動帶新 id，無需 remount。

⚠️ 舊 helper `buildWorkspaceWhere()` 還在 `/api/analytics/route.ts` 用（已驗證 context 內），新 code 一律用 `resolveWorkspaceScope`。

### 8. UTM 建構器 + 白名單

- `UTMBuilder.tsx` 從 `/api/workspace/utm-settings` 讀 approved sources/mediums，放 datalist 優先順
- 打了非白名單值 → 即時 amber warning（還是能送，server 側會回 400）
- Server-side enforcement：`lib/utm-governance.ts::validateUtmAgainstGovernance()` 在 POST/PATCH/batch/batch-csv 都檢查
- 欄位有值時右邊顯示 **X 清除鍵**（不是 ChevronDown）— 否則 datalist 有值會自動過濾、看起來像壞掉

### 9. Custom domain (`go.engenius.ai`) + middleware

`NEXT_PUBLIC_SHORT_URL` ≠ `NEXT_PUBLIC_APP_URL` 時 middleware 啟動短域名守護（`src/middleware.ts`）：

| URL | 行為 |
|---|---|
| `go.engenius.ai/<code>` | **Internal rewrite** → `/s/<code>`（既有 redirect handler）— 短網址直接掛根目錄 |
| `go.engenius.ai/s/*`、`/link-*`、`/track.js`、`/api/track` | 直接 pass through |
| `go.engenius.ai/*`（其他） | **302 → engeniustech.com**（不暴露 dashboard / sign-in / API） |
| `mkt-shortlink.vercel.app/*` | 正常走 next-intl |

兩 env 相同時是 no-op（適合本機 / 還沒接 custom domain 的 staging）。

### 10. Kickstart wizard（活動啟動器）

`/campaigns/kickstart`：選 playbook（Product Launch / Exhibition Event）→ 自動展開 8–10 個頻道的 checklist（每個頻道一條 link，預填 source/medium/content）→ 一鍵 sequential POST `/api/links` 建完。

**擴充模式**：使用者輸入既有 utm_campaign 名稱時，wizard query `/api/links?campaign=<name>` 找出已建頻道，自動 uncheck 對應列（用 `useRef` 確保只 auto-uncheck 一次，不會 stomp 使用者手動切換）。完全成功的列在 submit 後也自動 uncheck，避免 partial-failure retry 重複建立。

Playbook 定義在 `lib/campaign-playbooks.ts`；name / description / channel label 走 i18n key `kickstartPlaybooks.{id}.channels.{id}.{label|hint}`。

### 11. Mobile responsive baseline

不是完整 mobile-first 重設計，是「行銷同事可以查 + 簡單建立」的 baseline。覆蓋：

- `src/app/layout.tsx` 設 viewport meta（device-width + initialScale=1）
- `globals.css` mobile fallback 區塊：`.table-scroll` wrapper、`.grid-resp-2`、`.tbl-wrap` 改 `overflow-x: auto`、`.page-head` / toolbar 在 ≤768px wrap、按鈕觸控 ≥40px / ghost ≥44px
- `LinkMobileCard.tsx` + `useMediaQuery` — `/links` 在 ≤768px 切換成 card view（標題、短網址、UTM pills、status、clicks 直立排列）
- KPI tile 用 `.kpi-row-3` className（不是 inline `gridTemplateColumns`），媒體查詢能生效
- `SyncButton` 的「Last synced」label 用 `.sync-button-label` class，mobile 隱藏

## Conventions

### Server / Client split 命名

- Server page 永遠叫 `page.tsx`（async function）
- Client 元件叫 `{Page}Client.tsx`（PascalCase，與資料夾同名）
- `/links` 已經**不是 SSR** — page.tsx 只做 auth gate + render `<LinksClient />`，資料走 useQuery。其他 dashboard 頁面也走同模式。
- 「SSR + initialData 傳 props」pattern 已棄用。新寫 dashboard 頁就直接 useQuery。
- 舊 `isInitialMount` / `hasInitialFetch` ref 模式**不再用**。

### React Query 使用規則

- 查詢 key 要**共用**（看 Architecture #5 的表）— 新增同類型資料用既有 key，不要另開新字串
- Mutation 成功後**一定**要 `qc.invalidateQueries({ queryKey: [...] })` — 看 Architecture #5「Mutation 後要 invalidate 什麼」清單
- 每頁的 PageHeader actions 要放 `<SyncButton queryKeys={[...]} />`，陣列傳該頁用到的 keys（每個 key 用 spread：`[...linksKey]`）
- API payload shape 變動時，**cache key 要 bump 版本號**（例：`campaigns-summary` → `campaigns-summary-v2`）— 不然舊 Redis cache 的資料會讓 client crash（舊物件沒新欄位）

### Cache 使用規則

```typescript
// 好
await cacheSet(key, value, 60);  // 必須 await

// 壞 — Vercel Lambda 會殺掉 pending promise
cacheSet(key, value, 60).catch(() => {});
```

### Prisma @@index

Prisma **不會自動**為 foreign key 建 DB index。新增 relation 時必須同時加 `@@index([field])`，否則 Supabase lint 會 flag。

### URL encoding

- Supabase DB password 含特殊字元要 URL encode（`?` → `%3F`）
- UTM value 用 `sanitizeUTMValue()` 清過（全小寫、底線、無特殊字元）

### i18n（雙語 + 業界慣例）

- 所有使用者看到的文字都要走 `next-intl` 的 `t()`
- 新增 i18n key 要同時改 `messages/en.json` + `messages/zh-TW.json`（JSON 驗證會檔下單邊）
- **刻意保留英文**（不要翻）：
  - UTM 參數名：`utm_source` / `utm_medium` / `utm_campaign` / `utm_content` / `utm_term`
  - 產業縮寫：`CVR` / `CTR` / `UTM` / `QR` / `URL` / `API` / `CSV`
  - datalist **選項值**（`google` / `cpc` / `email`…）— 這些是實際寫入 DB 的字串，翻了會跟 GA 對不上
- UTM 欄位 label 用**雙語並列**：「媒介 (Medium)」「來源 (Source)」「活動 (Campaign)」— 行銷人員看外部工具（GA、FB Pixel）需要認得英文原字
- 相對時間用 `formatRelativeTime(date, tCommon)` — 傳 `useTranslations("common")` 進去才會跟著 locale 切
- 共用 helper 組件（`SyncButton`、`TrendCell`）自己 `useTranslations()`，不要讓 caller 傳字串進去

### Column naming

Prisma schema 用 camelCase（`userId`），但 DB 欄位名是 snake_case（`user_id`）— 靠 `@map`。寫 raw SQL 要用 snake_case。

## Current Status

功能清單詳見 [README.md](README.md)。

### 🔜 Next Steps / Pending

- **i18n LinksClient / CreateLinkForm / LinkTableRow / LinkMobileCard 末端 spot-check** — Campaigns / Settings / Kickstart 已完整 i18n，但這幾個列表 / form 仍可能有零星硬編碼字串（特別是新加的 LinkMobileCard）
- **`ALLOWED_EMAILS` env 退役** — 目前作為過渡 fallback。確認所有現存使用者都已正式有 WorkspaceMember row 後可以刪除這個 env，讓 auth 完全 DB-driven
- **Secret rotation** — Supabase password / Google OAuth secret / Upstash token 曾貼對話裡 → 建議 rotate 一輪
- **Campaign leaderboard filter 精修** — 自動建的 Campaign 可能讓列表雜訊多（例如 `test`）。觀察真實使用後決定要不要加 "has goal / has > N clicks" filter
- **行動裝置 card view 擴展** — 目前只有 `/links` 有手機 card view。Campaign Leaderboard / Campaign Detail Links tab 還是橫向 scroll
- **Mobile-only：edit link 表單 + Kickstart wizard** — 表格 + A/B variant editor 在手機操作彆扭，建議走桌面
- **Observability** — Prod 只有 `console.error`。建議 Sentry / OpenTelemetry
- **Conversion UI 已隱藏但 infra 還在** — 使用者團隊目前不走 `/track.js` 追蹤，Dashboard 的 CVR / Conversion 欄位都移除。未來要重啟時，DB / API / 歸因邏輯完全 intact — 只要把 UI 加回來即可。相關檔案看 `commit 90d93d3`

## Deployment

| 環節 | 設定 |
|---|---|
| Production | Vercel (`mkt-shortlink`), team `ty510s-projects` |
| DB | Supabase `MKT-ShortLink`, Tokyo (`ap-northeast-1`) |
| Redis | Upstash Free, Tokyo |
| Domain | `https://mkt-shortlink.vercel.app` |

### Build command

```
prisma generate && next build
```
`postinstall` 也會跑 `prisma generate`（讓 Vercel fresh install 時 schema 有產）。

### Env vars（Vercel production 都已設好）

必填：`DATABASE_URL` (pooler) / `DIRECT_URL` / `AUTH_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SHORT_URL` / `IP_HASH_SALT` / `BOOTSTRAP_EMAILS`（緊急 admin email；至少 1 個給開機）
選填：`ALLOWED_EMAILS`（過渡相容，未來退役）、`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`

`NEXT_PUBLIC_SHORT_URL` 跟 `NEXT_PUBLIC_APP_URL` 不同時 middleware 啟動短域名守護（見 Architecture #9）。Production 短域名 = `https://go.engenius.ai`、app domain = `https://mkt-shortlink.vercel.app`。

Prisma datasource 需 `directUrl` 才能讓 `db push` 繞過 pgbouncer — schema 已設好。

## Common Pitfalls

1. **Fire-and-forget 在 Vercel 會被砍** — Lambda 一送 response 就 kill pending promises。任何 cache 寫入、log、side effect 必須 `await`。踩過這個坑才改掉 `cacheSet().catch()`。

2. **Supabase Free tier 上限 2 active projects** — 建第 3 個會失敗。若超限要先 pause/delete。

3. **Datalist 有值時會過濾自己** — HTML `<input list>` 當 input 有值，datalist 會只剩匹配項，看起來「下拉空了」。改用 X 清除按鈕處理，**新增類似欄位時要一起做**。

4. **`private` + `s-maxage` 無效** — Cache-Control `s-maxage` 在 `private` 時被忽略。browser-only cache 用 `max-age`。

5. **Next.js 16 searchParams 是 Promise** — Server Component 要 `await searchParams`。

6. **Prisma groupBy() 放 `Promise.all`** — analytics / campaigns-summary 都是一個 Promise.all 包多個 groupBy。新增聚合請**加進現有 Promise.all**，別另外 await。

7. **Client-side filter 有資料上限** — 別忘了當資料超過 cap 時顯示 banner。`/links` cap=500，`/analytics/raw` cap=10000 clicks + 90 天。

8. **Column 命名不一致** — Prisma model 欄位是 camelCase，DB column 多數是 snake_case（`@map`），**但有幾個沒 @map** 的是 camelCase quoted（如 `originalUrl`、`deletedAt`）。寫 raw SQL 前先看 schema。

9. **Click record 用 `after()` API** — `src/app/s/[code]/route.ts` 用 Next.js 15+ 的 `after()` 保證轉址不被 click 紀錄拖慢。別改回 sync。

10. **Root layout 必須存在 (`src/app/layout.tsx`)** — 不能只有 `[locale]/layout.tsx`。非 locale 頁（`link-*`、`share/`、`track.js`）需要 root layout 提供 `<html>/<body>`。只有一個 layout 能有 html/body，所以 locale layout 現在只放 `NextIntlClientProvider`。

11. **Middleware matcher 必須排除非 locale routes** — `src/middleware.ts` matcher 排除 `api|_next|_vercel|s/|auth/|link-|share/|.*\\..*`。新增 root-level 路由（例如未來加 `/api-docs`）要一併加進排除清單，否則會被 intl rewrite 到 `/zh-TW/xxx` 導致 404。

12. **Dedup window = 2 秒（不是 10）** — `DEDUP_WINDOW_SECONDS = 2` in redirect route。10 秒太 aggressive，會吃掉使用者正常的測試點擊（建完連結連點兩次只記 1 次）。`cacheSetIfAbsent` 在 Redis error 時 **fail-open**（return true）避免 Upstash hiccup 吃掉所有 click。

13. **Session ID 走 URL param（`?_sl=<sid>`）不走 cookie** — 跨任何 landing domain 都能歸因，避開 third-party cookie / ITP 問題。Landing 端 `/track.js` snippet 會清掉 address bar 的 `_sl` 避免汙染 GA referrer。

14. **Campaign 自動建立是刻意的** — 填 `utmCampaign` 就會 upsert Campaign row（status=ACTIVE）。使用者改 link 的 utmCampaign 時也會 trigger。看到 Campaign 列表莫名多了一筆別當 bug，看 `lib/campaign-autolink.ts`。

15. **`resolveWorkspaceScope()` vs `buildWorkspaceWhere()`** — 新 code 全用 `resolveWorkspaceScope()`（驗 membership，防 IDOR）。`buildWorkspaceWhere()` 是舊 helper，只能在已驗證的 context 中當 builder 用（例如 `/api/analytics` 的子函式）。新增 API route 一律用前者。

16. **`prisma db push` 對新加的 `String[]` / unique 欄位會警告 "data loss"** — 是誤導；既有 rows 的新 array 欄位會取 default，既有 NULL 的 unique 欄位允許多 NULL。`--accept-data-loss` 是安全的。

17. **Redis cache 的 payload shape 變動要 bump key 版本** — `/api/analytics/campaigns-summary` 的 cache key 是 `campaigns-summary-v2`。如果 API response 多了欄位（例如新加了 `sparkline`），Redis 裡舊的 v1 payload 還活著 60s，期間 client 讀到沒有新欄位的物件 → `c.sparkline.some(...)` 這類 code 直接 crash 整頁。解法：改 shape 就 bump suffix（v2 → v3）。也建議在 client render site 加 `?? []` / `?? null` 當保險。

18. **hardcoded 字串切 locale 不會變** — 寫 JSX 時若要顯示文字一律 `t(...)`，**不要直接寫字串**。寫完馬上要到 `messages/en.json` + `messages/zh-TW.json` 兩邊加 key。連 `title="..."` tooltip、aria-label 都算。Survey 技巧：`grep '"[A-Z][a-zA-Z ]*"' some.tsx | grep -v 't('`。

19. **UTM Template 沒有 campaign 欄位** — 設計上刻意的：模板是「通路預設」（source / medium / content / term），campaign 每次建 link 時現填。schema 在 2026-04-19 把 `UTMTemplate.campaign` 砍了，API / UI / interface 都對齊。不要以為「模板漏寫 campaign」幫它加回去 — 那會破壞「一個模板可以橫跨多個 campaign」的模式。

20. **UTM campaign 欄位用的是 CampaignCombobox 不是 datalist** — `source` / `medium` 還是用原生 `<input list="...">` datalist，但 `utm_campaign` 改成自訂 combobox（見 `UTMBuilder.tsx` 底部 `CampaignCombobox`）。理由：要讓「➕ 建立新活動」成為第一級選項，原生 datalist 無法做。如果未來想換回原生 datalist，要處理「如何在下拉中提供建立動作」。

21. **權限檢查一律用 `canUserActOnResource`，不要用 `User.role`** — `lib/workspace.ts` 的 helper 才是真實的 workspace 角色判斷。舊 code 寫過 12 處 `session.user.role === "MEMBER" && createdById !== session.user.id` 全部清乾淨改用 helper（commit `17d8cc0`）。`User.role` 現在只剩 `/audit-log` sidebar gating 在用，profile 顯示也改讀 `currentWorkspace.role`。新加 API route 直接 follow helper pattern。

22. **dashboard 之外的頁要自己包 `<SessionProvider>`** — `[locale]/layout.tsx` 只包 `NextIntlClientProvider`；只有 `(dashboard)` route group 透過 `Providers.tsx` 才有 SessionProvider。如果新加的頁面用 `useSession()` 又不在 dashboard 底下（例：`/invite/[token]`），必須**自己加一個 `layout.tsx` `"use client"` 包 `<SessionProvider>`**，不然頁面 mount 就炸 client-side exception。看 `src/app/[locale]/invite/[token]/layout.tsx` 範例。

23. **Auto-accept 後再點 invite link 會看到 ACCEPTED status** — `events.signIn` hook 在 OAuth 成功時就把 invitation 標 ACCEPTED + 建 WorkspaceMember。再點 invite link → GET `/api/invitations/[token]` 看到 ACCEPTED → API **回 200 + `alreadyAccepted: true`**（不是 400 error）。Page 用這個 flag 顯示綠色「已加入」+ 「Go to dashboard」按鈕。**不要**改回 400 — 會讓正常使用者看到紅色錯誤。

24. **Orphan link（`workspaceId=NULL`）防護有兩道**：(a) `lib/fetch-workspace.ts` 在 client 自動塞 `x-workspace-id` header；(b) `resolveWorkspaceScope` 在 server 沒拿到 header 時 fallback 到使用者最早加入的 workspace。理論上不會再產生 orphan，但歷史資料還是有 → `scripts/backfill-workspace-id.mjs` 是 idempotent 補洞 script，看到 OWNER 抱怨「看不到同事連結」就跑 dry-run 檢查。

25. **Leaderboard 的「ghost row」過濾規則**（`/api/analytics/campaigns-summary/route.ts`）：bucket 在 `b.id !== null || b.hasActiveLink` 才保留 — 已刪 Campaign 但還有 ACTIVE link 會留下顯示「僅 UTM」badge 提醒清理；已刪 Campaign + 全部 link PAUSED/ARCHIVED 直接 hide。Cache key 是 `campaigns-summary-v3`（v2 → v3 是因為這條 filter 規則改動）。改 payload shape 或 filter 都要 bump suffix。

26. **`User.role` 跟 `WorkspaceMember.role` 不同層級** — `User.role` 是全域帳號旗標（ADMIN/MANAGER/MEMBER/VIEWER），現在**只剩 sidebar 用來決定 `/audit-log` 是否顯示**。真正的權限走 `WorkspaceMember.role`（OWNER/ADMIN/MEMBER/VIEWER）。Sidebar 個人卡片、Settings → 個人資料的「角色」欄都讀 `currentWorkspace?.role` 不要讀 `session.user.role`。
