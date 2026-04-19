# Short Link Manager

行銷部專用短網址管理系統 (Internal Marketing URL Shortener)

## 功能特色

### 核心功能

| 功能 | 說明 |
|------|------|
| **短網址管理** | 建立、編輯、刪除短連結，支援自訂代碼或自動生成 7 位 Base62 代碼 |
| **UTM 參數建構器** | 內建 UTM 參數編輯器，預設常用來源（Facebook、Instagram、Google Ads 等）；Campaign 欄位是自訂 combobox — 輸入時下拉既有活動，找不到符合的就可以「➕ 建立新活動 'xxx'」inline 直接建立 |
| **UTM 白名單 Governance** | Workspace 層級設定核准的 source / medium；違反時伺服器拒絕 + UI 即時警告 |
| **UTM 模板系統** | 儲存常用 UTM 組合為模板（通路級預設，如「EDM 週報」「FB 付費廣告」）；快速套用到新連結。**不綁定 campaign** — 同一個模板可橫跨多個活動 |
| **批次建立（固定 URL + 多 content）** | 一次建立多個短網址變體（如多位 KOL 的追蹤連結） |
| **CSV 匯入批次建立** | 每 row 獨立 URL / UTM / tags / 排程 / 地區限制，上限 500 row |
| **OG 縮圖自動抓取** | 建連結後背景抓目標頁的 `og:image` / `og:title` 作為預覽縮圖 |
| **QR Code 產生** | 自動為每個短網址產生 QR Code，支援 PNG 下載與複製到剪貼簿 |
| **連結分組與標籤** | 使用群組和標籤整理連結，支援多標籤篩選 |
| **連結複製** | 一鍵複製既有連結設定，快速建立變體 |
| **A/B 多目的地** | 單一短網址可設定 2–4 個目的 URL + 權重，後端加權隨機分流，`Click.variantId` 記錄每次走哪條 |
| **排程啟用** | 設定 `startsAt`，到時間才開始轉址（前顯示 "Not yet active" 頁） |
| **地區限制** | `allowedCountries` ISO 代碼列表，非名單訪客顯示 "Geo blocked" 頁 |

### 行銷活動管理

| 功能 | 說明 |
|------|------|
| **Campaign 管理** | 建立行銷活動（Campaign），設定預設 UTM Source / Medium、顯示名稱、描述 |
| **Campaign 自動綁定** | 建連結時填 `utm_campaign` 自動建 Campaign row；填同名就綁同一個 — 使用者不用額外「建 Campaign」 |
| **活動狀態生命週期** | Draft → Active → Completed → Archived 四階段管理 |
| **KPI 目標追蹤** | 每個 Campaign 可設 `goalClicks` 目標，Detail 頁顯示進度條 + 達標慶祝 |
| **活動排行榜** | Campaigns 列表顯示每個活動的 clicks / 7 天趨勢（sparkline + ±%）/ 最後活動時間 / goal 達成率，可排序 |
| **多 Campaign 比較** | 列表勾選 2-4 個 → 上方顯示 daily clicks overlay 折線；進 `/campaigns/compare` 看 side-by-side 深度比較（winner cards + 每活動 top source/medium/link） |
| **Campaign Detail 三 tabs** | Overview（KPI + 30d 趨勢）/ Traffic（來源/裝置/地區拆解）/ Links（活動內每條連結 + 獨立訪客數 + 佔比 + 7 天趨勢 + 最後點擊） |
| **活動標籤** | 為活動加上標籤分類，方便搜尋篩選 |
| **跨頁面 Campaign 篩選** | 在連結、分析頁面皆可依 Campaign 篩選 |
| **Orphan Links 提醒** | Campaigns 頁自動列出沒綁 Campaign 的連結（含目的網址 + 最後點擊時間），一鍵跳去補綁 |

### 數據分析

| 功能 | 說明 |
|------|------|
| **點擊追蹤** | 即時記錄每次點擊，含重複點擊去重（2 秒窗口）與 Bot 偵測 |
| **轉換追蹤 (Conversion Tracking)** | Landing page 放一段 snippet（`/track.js`）或後端 webhook 呼叫 `/api/track`，透過 session token 歸因回來源連結；支援 event name / value / currency / externalId（idempotency） |
| **CVR 顯示** | 連結列表 / Campaign 列表 / Compare 頁都自動算 CVR；超過 0 才顯示，避免雜訊 |
| **趨勢圖表** | 視覺化呈現點擊數據（支援 24h / 7d / 30d / 90d / 自訂範圍） |
| **來源分析** | 追蹤流量來源（Referrer） |
| **裝置分析** | Mobile / Tablet / Desktop 分佈 |
| **瀏覽器分析** | Chrome / Safari / Firefox 等統計 |
| **作業系統** | iOS / Android / Windows / macOS 分佈 |
| **地理位置** | 國家與城市層級分析（GeoIP） |
| **時段分佈** | 24 小時內各時段的點擊熱度 |
| **UTM 維度分析** | Campaign / Source / Medium / Content 交叉分析 |
| **Campaign 篩選分析** | 選擇特定 Campaign 後，所有圖表與統計自動聚焦該活動 |
| **匯出 CSV** | 匯出連結清單或點擊原始數據 |

### 團隊協作

| 功能 | 說明 |
|------|------|
| **工作區 (Workspace)** | 多工作區支援，每個團隊獨立管理連結與活動 |
| **角色權限** | 系統層級 Admin / Manager / Member / Viewer 四級權限 |
| **工作區角色** | 工作區層級 Owner / Admin / Member / Viewer 獨立權限 |
| **成員邀請** | 透過 Email 邀請成員加入工作區，含邀請連結與到期時間 |
| **共享報告** | 產生公開分享連結，支援密碼保護、到期時間、最大瀏覽次數 |
| **審計日誌** | 記錄所有操作（建立、更新、刪除、分享、邀請成員等） |
| **使用者管理** | Admin 可管理團隊成員與角色 |

### 其他特色

- **國際化 (i18n)** - 支援英文與繁體中文；UTM 參數名（`utm_source` 等）與產業縮寫（CVR / CTR / QR）刻意保留英文，對齊 GA / 外部工具
- **切頁瞬間完成** - 所有 dashboard 頁面走 React Query client cache，第一次進站後切換 tabs 零網路延遲；每頁右上角「Sync」按鈕手動強制重抓 + 顯示「最後同步時間」
- **響應式設計** - 適配桌面與行動裝置
- **軟刪除** - 已刪除連結保留於資料庫，可供稽核
- **連結生命週期** - 排程啟用（`startsAt`）/ 到期（`expiresAt`）/ 最大點擊次數（`maxClicks`）
- **Rate Limiting** - 重導向端點（per-IP 60/min）與分享報告端點均設有速率限制
- **IP 匿名化** - 使用 Hash Salt 對 IP 位址進行匿名化處理
- **Workspace IDOR 防護** - `resolveWorkspaceScope()` 驗 membership，避免越權讀取他人 workspace

---

## 技術架構

| 類別 | 技術 |
|------|------|
| **框架** | Next.js 16 (App Router) + React 19 |
| **資料庫** | PostgreSQL + Prisma 6 ORM |
| **Client cache** | @tanstack/react-query v5（dashboard 全面採用） |
| **Server cache**（選配）| Upstash Redis（REST API）|
| **認證** | NextAuth.js v5 (Google OAuth) + Email 白名單 |
| **樣式** | Tailwind CSS 4 + 自訂設計系統（Inter + JetBrains Mono） |
| **圖表** | Recharts + 自製 SVG sparkline |
| **國際化** | next-intl（英文 / 繁體中文）|
| **驗證** | Zod |

### 效能架構

- **React Query client cache** — 所有 dashboard 頁面透過 `useQuery` 共用 in-memory cache（staleTime 5min / gcTime 30min），切頁瞬間完成；auto-refetch 全關，使用者透過「Sync」按鈕手動強制重抓
- **Mutation 自動失效** — 建 / 改 / 刪 link、改 goal 等操作會 `invalidateQueries` 相關 keys，其他頁下次進入才重抓
- **Client-side filter** — 列表頁以 `useMemo` 做過濾、排序、聚合，切 filter 零網路
- **伺服器快取**（選配）— Upstash Redis 60s TTL，無 env vars 自動 no-op
- **載入骨架** — 每個路由有 `loading.tsx`，導航當下立即顯示 skeleton
- **Analytics raw 端點** — `/api/analytics/raw` 回傳 90 天原始點擊（上限 10,000 筆），前端用 `lib/analytics/compute.ts` 聚合；這個 payload 的 query key 在 `/analytics`、Campaign Detail、Compare 三頁共用，整 session 只抓一次

---

## 使用者角色

### 系統角色

| 角色 | 權限說明 |
|------|----------|
| **Admin** | 完整權限：系統設定、使用者管理、檢視所有連結與報告 |
| **Manager** | 檢視所有連結與報告、編輯團隊連結 |
| **Member** | 建立 / 編輯 / 刪除自己的連結 |
| **Viewer** | 僅可檢視被分享的特定報告 |

### 工作區角色

| 角色 | 權限說明 |
|------|----------|
| **Owner** | 完整控制權，包括刪除工作區 |
| **Admin** | 管理成員和工作區內所有資源 |
| **Member** | 建立和管理自己的資源 |
| **Viewer** | 僅能檢視 |

---

## 快速開始

### 系統需求

- Node.js 18+
- PostgreSQL 資料庫
- Google OAuth 憑證

### 本地安裝

1. Clone 專案：
```bash
git clone <repository-url>
cd shortlink-app
```

2. 安裝相依套件：
```bash
npm install
```

3. 設定環境變數：
```bash
cp .env.example .env
```

編輯 `.env` 填入必要設定：
- `DATABASE_URL` - PostgreSQL 連線字串
- `AUTH_SECRET` - 執行 `openssl rand -base64 32` 產生
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - 從 Google Cloud Console 取得
- `ALLOWED_EMAILS` - （選填）Email 白名單，逗號分隔，例 `a@x.com,b@y.com`

4. 初始化資料庫：
```bash
npx prisma generate
npx prisma db push
```

5. 啟動開發伺服器：
```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000) 即可使用。

---

## 部署指南

推薦組合：**Vercel + Supabase + Upstash**（全部可免費方案起步）。

### 步驟 1：Supabase（資料庫）

1. 到 [Supabase Console](https://supabase.com/dashboard) 建立新 project
2. Region 建議選 **Tokyo (ap-northeast-1)** — 跟 Vercel 東京 edge 同區
3. 專案建好後到 **Settings → Database → Connect**，選 **ORMs → Prisma** 取得兩條連線字串：
   - `DATABASE_URL`（pooler，port 6543）→ 給 app 用
   - `DIRECT_URL`（直連，port 5432）→ 給 migration 用
4. 密碼含 `?`、`@` 等特殊字元要 URL encode（`?` → `%3F`）

### 步驟 2：Vercel（部署 + 自動 CI/CD）

1. `npx vercel link` 或到 Vercel Dashboard **Import Git Repository**
2. 自動偵測為 Next.js，預設 build command 就是 `prisma generate && next build`
3. 設定環境變數（見下方 [環境變數說明](#環境變數說明)）：
   ```bash
   # 用 CLI 批次設
   vercel env add DATABASE_URL production
   vercel env add DIRECT_URL production
   vercel env add AUTH_SECRET production
   # ... 其他
   ```
4. `vercel --prod --yes` 部署
5. 到 Google Cloud Console 把 Vercel domain 加到 OAuth **Authorized redirect URIs**：
   ```
   https://{your-project}.vercel.app/api/auth/callback/google
   ```

### 步驟 3：Upstash Redis（選配快取，5 分鐘完成）

Analytics / Dashboard 查詢貴，加上 Redis 後重複瀏覽幾乎瞬間。**不設也能跑**（code 有 graceful fallback）。

1. 到 [Upstash Console](https://console.upstash.com/) 建立 Redis database
2. Region 選 **Tokyo**；**Eviction 打開**（policy: `allkeys-lru`）
3. 到 database 頁面找 **REST API** 區塊，複製：
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. 加到 Vercel env vars，redeploy

### 步驟 4：Schema 推送

本機跑一次把 Prisma schema 推到 Supabase：

```bash
npx prisma db push
```

後續每次 schema 變動重跑一次即可。

### 其他部署平台

本應用相容任何支援 Next.js 的平台。無 Redis 時 `lib/cache.ts` 會 silent no-op，不會報錯，只是沒快取加速。

---

## 專案結構

```
src/
├── app/
│   ├── layout.tsx             # Root layout（<html>/<body>，給非 locale 頁用）
│   ├── [locale]/              # 國際化路由
│   │   ├── layout.tsx         # NextIntlClientProvider（無 html/body）
│   │   ├── (dashboard)/       # Route group（登入後的保護區）
│   │   │   ├── campaigns/     # 行銷活動管理（登入首頁）
│   │   │   │   ├── [name]/    # Campaign Detail（Overview / Traffic / Links tabs）
│   │   │   │   └── compare/   # 多活動 side-by-side 比較
│   │   │   ├── links/         # 連結管理
│   │   │   │   ├── new/       # 單筆建立
│   │   │   │   ├── batch/     # 固定 URL + 多 content 批次
│   │   │   │   ├── import/    # CSV 匯入批次建立
│   │   │   │   └── [id]/      # 編輯單一連結
│   │   │   ├── analytics/     # 全站維度分析
│   │   │   ├── templates/     # UTM 模板
│   │   │   ├── workspaces/    # 工作區管理
│   │   │   ├── users/         # 使用者管理（Admin）
│   │   │   ├── audit-log/     # 審計日誌
│   │   │   └── settings/      # 個人設定 + UTM Governance tab
│   │   └── page.tsx           # 根頁 → 登入時 redirect 到 /campaigns
│   ├── auth/                  # NextAuth 認證頁
│   ├── api/                   # API 路由（含 /api/track 轉換追蹤）
│   ├── s/[code]/              # 短網址轉址 + A/B variant + session attribution
│   ├── track.js/              # 公開 JS snippet（landing page 引用）
│   ├── share/[token]/         # 公開分享報告頁面
│   └── link-*/                # 狀態頁（expired / inactive / limit-reached /
│                              # not-yet-active / geo-blocked）
├── components/
│   ├── layout/                # Sidebar、語言切換
│   ├── forms/                 # 表單（建立連結、批次、CSV 匯入、UTM 建構器）
│   ├── links/                 # LinkCard / LinkTableRow（含 OG 縮圖）/ QR Code
│   ├── analytics/             # 折線圖 / 圓餅圖 / MultiCampaignChart
│   ├── campaigns/             # CampaignFilter
│   └── ...（tags / workspace / ui / providers）
├── lib/
│   ├── auth.ts                # NextAuth.js 設定
│   ├── prisma.ts              # Prisma 客戶端
│   ├── workspace.ts           # resolveWorkspaceScope() — 驗 membership
│   ├── ratelimit.ts           # 速率限制（重導向 + /api/track）
│   ├── cache.ts + cache-scopes.ts  # Redis wrapper + versioned invalidation
│   ├── geoip.ts               # IP 地理位置查詢
│   ├── og-scraper.ts          # 目標頁 og:image / og:title 抓取
│   ├── utm-governance.ts      # 工作區白名單驗證
│   ├── variants.ts            # A/B 權重 pick + session URL helper
│   ├── campaign-autolink.ts   # 自動 upsert Campaign from utm_campaign
│   ├── analytics/compute.ts   # Client-side 聚合（全 JS）
│   └── utils/                 # shortcode 生成、UTM 常數處理
├── i18n/                      # 國際化設定
├── messages/                  # 翻譯檔案（en.json、zh-TW.json）
└── middleware.ts              # next-intl routing（排除 /s/、/link-*、/share/ 等）

scripts/
└── backfill-campaign-autolink.mjs  # 一次性 orphan link → Campaign 綁定

screenshots/                   # UI 設計評估用截圖（gitignored 建議）
```

---

## API 端點

### 連結管理

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/links` | GET, POST | 列出 / 建立連結（Redis cached + versioned invalidation） |
| `/api/links/batch` | POST | 固定 URL + 多 content 批次建立 |
| `/api/links/batch-csv` | POST | CSV 檔案批次匯入（每 row 獨立 UTM / 排程 / 地區） |
| `/api/links/batch-actions` | POST | 批次操作（刪除、暫停、啟用、封存、加標籤） |
| `/api/links/[id]` | GET, PATCH, DELETE | 單一連結操作（PATCH 支援 A/B variants / 排程 / 地區） |
| `/api/links/[id]/clone` | POST | 複製連結 |
| `/api/links/[id]/preview` | GET | 預覽目標網址資訊 |

### 行銷活動

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/campaigns` | GET, POST | 列出 / 建立行銷活動 |
| `/api/campaigns/[id]` | GET, PATCH, DELETE | 單一活動操作 |
| `/api/utm-campaigns` | GET | UTM Campaign 聚合統計（連結數、點擊數） |

### 分析與匯出

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/analytics` | GET | 取得分析數據（支援 campaign、link、日期範圍篩選） |
| `/api/analytics/raw` | GET | 回傳 90d 原始點擊，給前端 `computeAnalytics()` 聚合 |
| `/api/analytics/campaigns-summary` | GET | Campaign leaderboard + orphan links + 每活動時序資料 |
| `/api/export/links` | GET | 匯出連結清單 CSV |
| `/api/export/analytics` | GET | 匯出點擊原始數據 CSV |

### 轉換追蹤

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/track` | POST, OPTIONS | 接收 landing page 回傳的 conversion 事件（公開 CORS，rate-limited） |
| `/track.js` | GET | 公開 JS snippet，提供 `window.Shortlink.convert({ event, value, currency, externalId })` |

### 模板與標籤

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/templates` | GET, POST | 列出 / 建立 UTM 模板 |
| `/api/templates/[id]` | GET, PATCH, DELETE | 單一模板操作 |
| `/api/tags` | GET, POST | 列出 / 建立標籤 |

### 分享

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/share` | POST | 建立分享連結 |
| `/api/share/[token]` | POST | 驗證並取得分享報告 |

### 工作區

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/workspaces` | GET, POST | 列出 / 建立工作區 |
| `/api/workspaces/[id]` | GET, PATCH, DELETE | 單一工作區操作 |
| `/api/workspaces/[id]/members` | GET, PATCH, DELETE | 管理工作區成員 |
| `/api/workspaces/[id]/invitations` | GET, POST, DELETE | 管理邀請 |
| `/api/invitations/[token]` | GET, POST | 查看 / 接受邀請 |

### 管理

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/users` | GET | 列出使用者（Admin） |
| `/api/users/[id]` | PATCH, DELETE | 使用者管理（Admin） |
| `/api/user/profile` | PATCH, DELETE | 個人資料管理 |
| `/api/audit-log` | GET | 審計日誌（Admin/Manager） |

---

## 環境變數說明

| 變數 | 必填 | 說明 |
|------|------|------|
| `DATABASE_URL` | 是 | Supabase pooler 連線字串（給 app 用） |
| `DIRECT_URL` | 是 | Supabase 直連字串（給 `prisma db push` 用） |
| `AUTH_SECRET` | 是 | NextAuth.js 加密金鑰 |
| `GOOGLE_CLIENT_ID` | 是 | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | 是 | Google OAuth Client Secret |
| `NEXT_PUBLIC_APP_URL` | 是 | 應用程式 URL |
| `NEXT_PUBLIC_SHORT_URL` | 是 | 短網址基底 URL |
| `IP_HASH_SALT` | 是 | IP 位址雜湊鹽值 |
| `ALLOWED_EMAILS` | 否 | Email 白名單（逗號分隔） |
| `UPSTASH_REDIS_REST_URL` | 否 | Upstash Redis REST URL（沒設則停用快取）|
| `UPSTASH_REDIS_REST_TOKEN` | 否 | Upstash Redis REST Token |

---

## 授權條款

Private - 僅供內部使用
