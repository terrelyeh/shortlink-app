# Short Link Manager

行銷部專用短網址管理系統 (Internal Marketing URL Shortener)

## 功能特色

### 核心功能

| 功能 | 說明 |
|------|------|
| **短網址管理** | 建立、編輯、刪除短連結，支援自訂代碼或自動生成 7 位 Base62 代碼 |
| **UTM 參數建構器** | 內建 UTM 參數編輯器，預設常用來源（Facebook、Instagram、Google Ads 等） |
| **UTM 模板系統** | 儲存常用 UTM 組合為模板，快速套用 |
| **批次建立** | 一次建立多個短網址變體（如多位 KOL 的追蹤連結） |
| **QR Code 產生** | 自動為每個短網址產生 QR Code |
| **連結分組與標籤** | 使用群組和標籤整理連結，支援多標籤篩選 |
| **連結複製** | 一鍵複製既有連結設定，快速建立變體 |

### 行銷活動管理

| 功能 | 說明 |
|------|------|
| **Campaign 管理** | 建立行銷活動（Campaign），設定預設 UTM Source / Medium |
| **活動狀態生命週期** | Draft → Active → Completed → Archived 四階段管理 |
| **活動標籤** | 為活動加上標籤分類，方便搜尋篩選 |
| **跨頁面 Campaign 篩選** | 在連結、分析、儀表板頁面皆可依 Campaign 篩選 |
| **儀表板活動摘要** | 首頁直接顯示 Top Campaigns 排行（依點擊數） |

### 數據分析

| 功能 | 說明 |
|------|------|
| **點擊追蹤** | 即時記錄每次點擊，含重複點擊去重與 Bot 偵測 |
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

- **國際化 (i18n)** - 支援英文與繁體中文
- **響應式設計** - 適配桌面與行動裝置
- **軟刪除** - 已刪除連結保留於資料庫，可供稽核
- **連結過期** - 設定到期時間或最大點擊次數
- **Rate Limiting** - 重導向端點與分享報告端點均設有速率限制
- **IP 匿名化** - 使用 Hash Salt 對 IP 位址進行匿名化處理

---

## 技術架構

| 類別 | 技術 |
|------|------|
| **框架** | Next.js 16 (App Router) + React 19 |
| **資料庫** | PostgreSQL + Prisma 6 ORM |
| **快取**（選配）| Upstash Redis（REST API）|
| **認證** | NextAuth.js v5 (Google OAuth) + Email 白名單 |
| **樣式** | Tailwind CSS 4 |
| **圖表** | Recharts |
| **國際化** | next-intl（英文 / 繁體中文）|
| **驗證** | Zod |

### 效能架構

- **Server Components + Client-side filter** — 列表頁（連結 / 活動 / 分析）由 Server Component 預先載入資料，Client Component 以 `useMemo` 做過濾、排序、聚合，切 filter 零延遲
- **兩層快取** — 瀏覽器 `Cache-Control` + Upstash Redis（60s TTL）
- **載入骨架** — 每個路由有 `loading.tsx`，導航當下立即顯示 skeleton
- **Analytics raw 端點** — `/api/analytics/raw` 回傳 90 天原始點擊（上限 10,000 筆），前端用 `lib/analytics/compute.ts` 聚合

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
│   ├── [locale]/              # 國際化路由
│   │   ├── (dashboard)/       # 受保護的儀表板路由
│   │   │   ├── dashboard/     # 總覽儀表板
│   │   │   ├── links/         # 連結管理（含新增、批次建立）
│   │   │   ├── campaigns/     # 行銷活動管理
│   │   │   ├── templates/     # UTM 模板
│   │   │   ├── analytics/     # 數據分析
│   │   │   ├── workspaces/    # 工作區管理（含成員、設定）
│   │   │   ├── users/         # 使用者管理（Admin）
│   │   │   ├── audit-log/     # 審計日誌
│   │   │   └── settings/      # 個人設定
│   │   └── auth/              # 認證頁面
│   ├── api/                   # API 路由
│   ├── s/[code]/              # 短網址重導向處理
│   └── share/[token]/         # 公開分享報告頁面
├── components/
│   ├── layout/                # 版面元件（Sidebar、語言切換）
│   ├── forms/                 # 表單元件（建立連結、批次建立、UTM 建構器）
│   ├── links/                 # 連結相關元件（LinkCard、QR Code）
│   ├── analytics/             # 分析圖表元件（折線圖、圓餅圖）
│   ├── campaigns/             # Campaign 元件（CampaignFilter）
│   ├── tags/                  # 標籤元件（TagInput）
│   ├── workspace/             # 工作區元件（WorkspaceSwitcher）
│   ├── ui/                    # 通用 UI 元件（Toast）
│   └── providers/             # Context Providers
├── hooks/
│   └── useDebounce.ts         # 防抖 Hook
├── lib/
│   ├── auth.ts                # NextAuth.js 設定
│   ├── prisma.ts              # Prisma 客戶端
│   ├── workspace.ts           # 工作區查詢工具
│   ├── rate-limit.ts          # 速率限制
│   ├── geoip.ts               # IP 地理位置查詢
│   └── utils/                 # 工具函式（短碼生成、UTM 處理）
├── i18n/                      # 國際化設定
└── messages/                  # 翻譯檔案（en.json、zh-TW.json）
```

---

## API 端點

### 連結管理

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/links` | GET, POST | 列出 / 建立連結（支援 campaign、tag、status 篩選） |
| `/api/links/batch` | POST | 批次建立連結 |
| `/api/links/batch-actions` | POST | 批次操作（刪除、暫停、啟用、封存） |
| `/api/links/[id]` | GET, PATCH, DELETE | 單一連結操作 |
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
| `/api/export/links` | GET | 匯出連結清單 CSV |
| `/api/export/analytics` | GET | 匯出點擊原始數據 CSV |

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
