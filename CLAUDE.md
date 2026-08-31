# CLAUDE.md — Project Context

> Last updated: 2026-08-31 — 權限 helper 收斂進 `lib/workspace.ts`、Campaign unique 約束、analytics IDOR 修復、內部導航改用 Link、正式資料清理；架構與檔案樹拆到 `docs/`

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

完整檔案樹見 [`docs/file-structure.md`](docs/file-structure.md)。關鍵入口：

| 路徑 | 為什麼重要 |
|---|---|
| `src/app/layout.tsx` | Root layout，提供 `<html>/<body>`。非 locale 頁（`/link-*`、`/share`、`/track.js`）靠它 |
| `src/app/[locale]/(dashboard)/` | 主要頁面。route group，不是 `/dashboard` 路徑 |
| `src/lib/workspace.ts` | ⭐ 所有權限與範圍判斷的單一來源 |
| `src/lib/analytics/compute.ts` | Client 端聚合（純 JS），dashboard 效能的關鍵 |
| `src/lib/cache.ts` + `cache-scopes.ts` | Redis wrapper + invalidation 入口 |
| `src/middleware.ts` | next-intl routing + 短域名守護 |
| `prisma/schema.prisma` | FK 索引不會自動建，加 relation 要一併加 `@@index` |
| `messages/{en,zh-TW}.json` | 每新增使用者可見字串就兩邊都要加 |
| `scripts/` | 維運腳本，全部預設 dry-run，`--apply` 才寫入 |

## Architecture & Data Flow

完整說明見 [`docs/architecture.md`](docs/architecture.md)。各節摘要：

1. **Campaign-centric 導航** — 登入導向 `/campaigns`（Dashboard 已刪）。Campaigns = 活動駕駛艙，Analytics = 純全站維度分析，兩者職責不重疊
2. **Conversion attribution** — sessionId 走 `?_sl=` URL param 不走 cookie，跨任何 landing domain 都能歸因。**UI 已隱藏但 infra 完整保留**
3. **A/B 變體** — `ShortLink.variants: Json` + weighted random pick
4. **Campaign auto-link** — 填 `utmCampaign` 就自動 upsert Campaign row。有 `@@unique([workspaceId, name])` 防併發重複
5. **React Query 快取** ⭐ — 整個 dashboard 的資料層。共用 query key 表在 architecture.md，**新增同類資料要沿用既有 key**
6. **兩層 cache** — React Query（5min）→ Browser Cache-Control → Redis（60s）→ Postgres
7. **Auth + Workspace** ⭐ — DB-driven signIn gate；權限判斷全在 `lib/workspace.ts`：resource 層級用 `canUserActOnResource`、workspace 層級用 `isWorkspaceAdmin` + `resolveWorkspaceAccess`、`/api/workspaces/*` 用 `requireWorkspaceMember`
8. **UTM 建構器 + 白名單** — 治理設定只有 workspace OWNER/ADMIN 能改
9. **Custom domain** — `go.engenius.ai/<code>` internal rewrite 到 `/s/<code>`，其餘 302 到官網
10. **Kickstart wizard** — 選 playbook 一鍵建整套追蹤連結
11. **Mobile baseline** — ≤768px `/links` 切 card view
12. **測試點擊標記與軟重設** — `Click.isInternal` + `resetBatchId`，標記而非刪除，可整批還原
13. **CSV 匯出** — links / analytics / campaigns 三個 endpoint 共用 `csvResponse()`
14. **Analytics 進階指標** — 點擊衰減曲線 / 7×24 熱度圖（用 viewer 時區）/ 城市排行

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

### 使用狀況（2026-08-31 實際資料）

寫程式前值得知道的規模：**1 個 workspace、4 位使用者、38 條有效連結（含軟刪除共 65）、4,072 次點擊、4 個 Campaign、1 個 UTM 模板、0 筆 Conversion、0 封待處理邀請**。展會檔期（Interop / Computex 2026）跑完後進入淡季 — 近 30 天只有 39 次點擊，6/02 後沒有新連結。

**這是個低流量的內部工具**，不要為了想像中的規模做過度優化。資料量小也代表：改 schema、跑 backfill、直接對正式 DB 做維運都還算安全，但每次都要先 dry-run。

### 🔜 Next Steps / Pending

- **ESLint 剩 24 個問題**（12 errors / 12 warnings）— 都是死碼、`no-unescaped-entities`、3 個 `static-components`、2 個 `set-state-in-effect`（`useMediaQuery` + kickstart）。`no-html-link-for-pages` 已歸零
- **`social_prduct_launch` 的拼字錯誤** — utm_campaign 值拼成 `prduct`，但它有 3 條有效的 LinkedIn 連結、9 次點擊，改名會變更已發佈貼文的 utm 參數、切斷 GA 資料連續性。**建議維持現狀**，除非行銷端明確要求
- **`/api/user/profile` 的「最後一個 admin」保護從未生效** — 見 Pitfall #26
- **`ALLOWED_EMAILS` env 退役 — 前提已滿足，可執行** — 2026-08-31 查證 4 位使用者**全部**都有 WorkspaceMember row，所以 signIn gate 的條件 2 就足以放行，條件 4 已無作用。刪除步驟：先從 Vercel production env 移除（`vercel env rm ALLOWED_EMAILS production`），觀察一輪確認沒人被擋，再拿掉 `lib/auth.ts` 的 legacy 分支與本檔的相關描述。⚠️ 先確保 `BOOTSTRAP_EMAILS` 有值，那是唯一的緊急開機管道
- **Zeabur 資安事件後續（2026-08-27 事件，08-31 處理）** — 這個專案早期部署在 Zeabur，後來搬到 Vercel 但 **DB 一直是同一個 Supabase**。Zeabur 遭入侵導致該專案的 `DATABASE_URL` 外洩，而搬家時沒換過密碼 → 外洩的憑證在事件當下是有效的。
  - ✅ 已完成：Supabase 密碼輪替、Vercel `DATABASE_URL`/`DIRECT_URL` 更新 + redeploy、清空所有 Session（17 筆）、刪除所有 Zeabur 專案
  - **當時 Zeabur 有哪些變數（Zeabur 專案已刪、無法再查，以下由 git history 重建）**：`zeabur.json` 加於 2026-01-18、Vercel env 建於 04-17~18，所以 Zeabur 時期的集合 = commit `bb1c1ab` 的 `.env.example` 七項：`DATABASE_URL` / `AUTH_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `IP_HASH_SALT` / `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SHORT_URL`。
    **Upstash token（04-18 引入）與 `BOOTSTRAP_EMAILS`（04-23 引入）都晚於搬家，從未進過 Zeabur — 不需輪替。**
  - ⬜ 待辦：查 Supabase 連線紀錄有無異常來源。剩下三個機密都**不符合** Zeabur 信中的比對條件（名稱清單 + AWS/GitHub/Anthropic/OpenRouter/OpenAI/Stripe 值格式），但那是**第二封、範圍已擴大過一次**的通知，不宜全信：
    - `AUTH_SECRET` — **建議輪替**（`openssl rand -base64 32` → 更新 Vercel → redeploy）
    - `GOOGLE_CLIENT_SECRET` — 看保守程度。Google Cloud Console 加新 secret → 更新 Vercel → 驗證登入 → 才刪舊的
    - `IP_HASH_SALT` — 傾向不動，見下
  - ⚠️ **`IP_HASH_SALT` 若外洩要特別處理** — salt 一旦已知，4,000+ 筆 `Click.ipHash` 就能被反推回真實 IP（IPv4 只有 2^32），等於「匿名點擊紀錄」變成「可識別個人的瀏覽紀錄」。輪替 salt 會讓新舊 hash 對不起來，要接受去重統計斷一次
  - 💡 **輪替 `AUTH_SECRET` 的最佳時機是「剛清空 session 之後」** — 它簽章 session cookie，平常換會把所有人踢出去；session 已經是空的時候換，額外成本為零
- **i18n 末端 spot-check** — LinksClient / CreateLinkForm / LinkTableRow / LinkMobileCard 仍可能有零星硬編碼字串
- **行動裝置 card view 擴展** — 目前只有 `/links` 有手機 card view。Campaign Leaderboard / Campaign Detail Links tab 還是橫向 scroll
- **Mobile-only：edit link 表單 + Kickstart wizard** — 表格 + A/B variant editor 在手機操作彆扭，建議走桌面
- **Observability** — Prod 只有 `console.error`。建議 Sentry / OpenTelemetry
- **Conversion UI 已隱藏但 infra 還在** — 使用者團隊目前不走 `/track.js` 追蹤，Dashboard 的 CVR / Conversion 欄位都移除。未來要重啟時，DB / API / 歸因邏輯完全 intact — 只要把 UI 加回來即可。相關檔案看 `commit 90d93d3`

## Deployment

| 環節 | 設定 |
|---|---|
| Production | Vercel (`mkt-shortlink`), team `ty510s-projects` |
| Vercel function region | **東京 `hnd1`**（`vercel.json` 釘死） |
| DB | Supabase `MKT-ShortLink`, Tokyo (`ap-northeast-1`) |
| Redis | Upstash Free, Tokyo |
| Domain | `https://mkt-shortlink.vercel.app` |

⚠️ **`vercel.json` 的 `regions: ["hnd1"]` 不要刪。** Vercel 預設 function 跑在
`iad1`（美東），但 DB + Redis 都在東京。預設情況下每個 query 跨太平洋
(~150-170ms RTT)，dashboard 一個 request 串多個 query 會疊到 600ms~1s。
釘到 `hnd1` 跟 DB 同區後每個 round-trip 降到 ~1-5ms。Hobby plan 支援單一
region。改 DB region 的話這裡要一起改。

### Build command

```
prisma generate && next build
```
`postinstall` 也會跑 `prisma generate`（讓 Vercel fresh install 時 schema 有產）。

### Env vars（Vercel production 都已設好）

必填：`DATABASE_URL` (pooler) / `DIRECT_URL` / `AUTH_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SHORT_URL` / `IP_HASH_SALT` / `BOOTSTRAP_EMAILS`（緊急 admin email；至少 1 個給開機）
選填：`ALLOWED_EMAILS`（過渡相容，**退役前提已滿足** — 見 Next Steps）、`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`

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

14. **Campaign 自動建立是刻意的** — 填 `utmCampaign` 就會 upsert Campaign row（status=ACTIVE）。使用者改 link 的 utmCampaign 時也會 trigger。看到 Campaign 列表莫名多了一筆別當 bug，看 `lib/campaign-autolink.ts`。**`Campaign` 有 `@@unique([workspaceId, name])`**，所以新增任何建立 Campaign 的路徑都要處理 P2002（不然使用者會看到裸的 500）。

15. **吃 id 參數的 endpoint 不能拿 id 取代 scope 過濾（IDOR）** — `linkId` / `campaignId` 這類參數要**併入** scoped 查詢當額外條件：`where: linkId ? { ...whereLinks, id: linkId } : whereLinks`。寫成 `if (linkId) whereClicks.shortLinkId = linkId` 就是繞過 workspace 過濾，任何登入者猜到 id 就能讀別人的資料。`/api/analytics` 和 `/api/export/analytics` 都踩過。Workspace scoping 只有 `resolveWorkspaceScope()` 一條路（`buildWorkspaceWhere()` 已刪除）。

16. **`prisma db push` 對新加的 `String[]` / unique 欄位會警告 "data loss"** — 是誤導；既有 rows 的新 array 欄位會取 default，既有 NULL 的 unique 欄位允許多 NULL。`--accept-data-loss` 是安全的。

17. **Redis cache 的 payload shape 變動要 bump key 版本** — `/api/analytics/campaigns-summary` 的 cache key 是 `campaigns-summary-v2`。如果 API response 多了欄位（例如新加了 `sparkline`），Redis 裡舊的 v1 payload 還活著 60s，期間 client 讀到沒有新欄位的物件 → `c.sparkline.some(...)` 這類 code 直接 crash 整頁。解法：改 shape 就 bump suffix（v2 → v3）。也建議在 client render site 加 `?? []` / `?? null` 當保險。

18. **hardcoded 字串切 locale 不會變** — 寫 JSX 時若要顯示文字一律 `t(...)`，**不要直接寫字串**。寫完馬上要到 `messages/en.json` + `messages/zh-TW.json` 兩邊加 key。連 `title="..."` tooltip、aria-label 都算。Survey 技巧：`grep '"[A-Z][a-zA-Z ]*"' some.tsx | grep -v 't('`。

19. **UTM Template 沒有 campaign 欄位** — 設計上刻意的：模板是「通路預設」（source / medium / content / term），campaign 每次建 link 時現填。schema 在 2026-04-19 把 `UTMTemplate.campaign` 砍了，API / UI / interface 都對齊。不要以為「模板漏寫 campaign」幫它加回去 — 那會破壞「一個模板可以橫跨多個 campaign」的模式。

20. **UTM campaign 欄位用的是 CampaignCombobox 不是 datalist** — `source` / `medium` 還是用原生 `<input list="...">` datalist，但 `utm_campaign` 改成自訂 combobox（見 `UTMBuilder.tsx` 底部 `CampaignCombobox`）。理由：要讓「➕ 建立新活動」成為第一級選項，原生 datalist 無法做。如果未來想換回原生 datalist，要處理「如何在下拉中提供建立動作」。

21. **權限檢查一律用 `lib/workspace.ts` 的 helper，絕不用 `User.role`** — 動單一資源用 `canUserActOnResource()`；workspace 層級的管理權（治理設定、稽核紀錄）用 `isWorkspaceAdmin()` + `resolveWorkspaceAccess()`；`/api/workspaces/*` 這種 workspaceId 來自路由參數、又需要完整 member/workspace row 的用 `requireWorkspaceMember()`。**三個都在 `lib/workspace.ts`，不要在 route 裡自己複製一份**（曾經有 3 份相同的本地副本，2026-08-31 收斂）。⚠️ **實際資料裡每個使用者的 `User.role` 都是 `MEMBER`，包含 workspace OWNER** — 所以 `["ADMIN","MANAGER"].includes(session.user.role)` 這種檢查等於「拒絕所有人」，而且沒有 UI 可以改 `User.role`（`/users` 頁已砍）。`/api/workspace/utm-settings` PATCH 和 `/api/audit-log` GET 都因此對全員回 403 過（2026-08-31 修）。

22. **dashboard 之外的頁要自己包 `<SessionProvider>`** — `[locale]/layout.tsx` 只包 `NextIntlClientProvider`；只有 `(dashboard)` route group 透過 `Providers.tsx` 才有 SessionProvider。如果新加的頁面用 `useSession()` 又不在 dashboard 底下（例：`/invite/[token]`），必須**自己加一個 `layout.tsx` `"use client"` 包 `<SessionProvider>`**，不然頁面 mount 就炸 client-side exception。看 `src/app/[locale]/invite/[token]/layout.tsx` 範例。

23. **Auto-accept 後再點 invite link 會看到 ACCEPTED status** — `events.signIn` hook 在 OAuth 成功時就把 invitation 標 ACCEPTED + 建 WorkspaceMember。再點 invite link → GET `/api/invitations/[token]` 看到 ACCEPTED → API **回 200 + `alreadyAccepted: true`**（不是 400 error）。Page 用這個 flag 顯示綠色「已加入」+ 「Go to dashboard」按鈕。**不要**改回 400 — 會讓正常使用者看到紅色錯誤。

24. **Orphan link（`workspaceId=NULL`）防護有兩道**：(a) `lib/fetch-workspace.ts` 在 client 自動塞 `x-workspace-id` header；(b) `resolveWorkspaceScope` 在 server 沒拿到 header 時 fallback 到使用者最早加入的 workspace。理論上不會再產生 orphan，但歷史資料還是有 → `scripts/backfill-workspace-id.mjs` 是 idempotent 補洞 script，看到 OWNER 抱怨「看不到同事連結」就跑 dry-run 檢查。

25. **Leaderboard 的「ghost row」過濾規則**（`/api/analytics/campaigns-summary/route.ts`）：bucket 在 `b.id !== null || b.hasActiveLink` 才保留 — 已刪 Campaign 但還有 ACTIVE link 會留下顯示「僅 UTM」badge 提醒清理；已刪 Campaign + 全部 link PAUSED/ARCHIVED 直接 hide。Cache key 是 `campaigns-summary-v3`（v2 → v3 是因為這條 filter 規則改動）。改 payload shape 或 filter 都要 bump suffix。

26. **`User.role` 跟 `WorkspaceMember.role` 不同層級** — `User.role` 是全域帳號旗標（ADMIN/MANAGER/MEMBER/VIEWER），**已無任何權限用途**。真正的權限走 `WorkspaceMember.role`（OWNER/ADMIN/MEMBER/VIEWER）。Sidebar 的 `/audit-log` gating、個人卡片、Settings 的「角色」欄都讀 `currentWorkspace?.role`。`session.user.role` 現在只剩 `lib/auth.ts` 寫入、以及幾處 display fallback。**⚠️ `/api/user/profile` DELETE 的「不能刪最後一個 admin」保護仍在檢查 `role === "ADMIN"`，因為沒人是 ADMIN，那道保護從未生效過** — 要不要改成「最後一個 workspace OWNER」是待決的產品問題。

27. **清正式資料時照 App 自己的「軟刪除」慣例，不要硬刪 row** — 這個 schema 到處都是可還原的刪除狀態，維運腳本要對齊對應的 API handler，不要 `prisma.x.delete()`：

    | 對象 | 正確做法 | 對應 API |
    |---|---|---|
    | ShortLink | 設 `deletedAt` + 寫 `DELETE_LINK` 稽核 | `DELETE /api/links/[id]` |
    | WorkspaceInvitation | 設 `status: "CANCELLED"`（GET 會過濾掉） | `DELETE /api/workspaces/[id]/invitations` |
    | Click | 設 `isInternal` + `resetBatchId`，不刪 | `POST /api/utm-campaigns/[name]/reset-clicks` |
    | Campaign | 真的可以刪 row，但要先把 links 的 `campaignId` 解綁 | `DELETE /api/campaigns/[id]` |

    維運腳本一律照 `scripts/` 的慣例：**預設 dry-run、`--apply` 才寫入、可重複執行**，並加安全閘門（例如「有任何有效連結或點擊就拒絕刪除」）。


28. **換 DB 密碼不會讓已外洩的 session token 失效** — NextAuth 走 **database session**（`session({ session, user })` 的簽名可以確認，不是 JWT），`Session.sessionToken` 是**明文存在 DB** 裡的。任何人 dump 過資料庫就握有可用的登入憑證，而輪替 DB 密碼只擋住新的連線、**不會**讓那些 token 失效 —— 必須另外 `session.deleteMany({})`。憑證外洩的處理順序是：**先換密碼（切斷存取）→ 再清 session（作廢已複製的 token）**。反過來做的話，還有連線的攻擊者會直接讀到新產生的 token。


## 詳細文件

| 文件 | 內容 |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | 14 節架構與資料流完整說明（快取策略、權限模型、歸因、匯出…） |
| [`docs/file-structure.md`](docs/file-structure.md) | 完整檔案樹與各目錄職責 |
| [`README.md`](README.md) | 功能清單、快速開始、部署指南（給人看的） |
| [`docs/env-setup-guide.md`](docs/env-setup-guide.md) | 環境變數逐項設定說明 |
