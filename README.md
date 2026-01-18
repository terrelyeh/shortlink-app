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
| **連結分組** | 使用群組和標籤整理連結 |

### 數據分析

| 功能 | 說明 |
|------|------|
| **點擊追蹤** | 即時記錄每次點擊 |
| **趨勢圖表** | 視覺化呈現點擊數據（支援 24h / 7d / 30d / 90d） |
| **來源分析** | 追蹤流量來源（Referrer） |
| **裝置分析** | Mobile / Tablet / Desktop 分佈 |
| **瀏覽器分析** | Chrome / Safari / Firefox 等統計 |
| **作業系統** | iOS / Android / Windows / macOS 分佈 |
| **地理位置** | 國家與城市層級分析（需 GeoIP 服務） |

### 團隊協作

| 功能 | 說明 |
|------|------|
| **角色權限** | Admin / Manager / Member / Viewer 四級權限 |
| **共享報告** | 產生公開分享連結，支援密碼保護與到期時間 |
| **審計日誌** | 記錄所有操作（建立、更新、刪除、分享） |
| **使用者管理** | Admin 可管理團隊成員與角色 |

### 其他特色

- **國際化 (i18n)** - 支援英文與繁體中文
- **響應式設計** - 適配桌面與行動裝置
- **軟刪除** - 已刪除連結保留於資料庫，可供稽核
- **連結過期** - 設定到期時間或最大點擊次數

---

## 技術架構

| 類別 | 技術 |
|------|------|
| **框架** | Next.js 16 (App Router) |
| **資料庫** | PostgreSQL + Prisma ORM |
| **認證** | NextAuth.js v5 (Google OAuth) |
| **樣式** | Tailwind CSS 4 |
| **圖表** | Recharts |
| **國際化** | next-intl |
| **驗證** | Zod |

---

## 使用者角色

| 角色 | 權限說明 |
|------|----------|
| **Admin** | 完整權限：系統設定、使用者管理、檢視所有連結與報告 |
| **Manager** | 檢視所有連結與報告、編輯團隊連結 |
| **Member** | 建立 / 編輯 / 刪除自己的連結 |
| **Viewer** | 僅可檢視被分享的特定報告 |

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
- `ALLOWED_EMAIL_DOMAIN` - （選填）限制登入網域

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

### Zeabur 部署（推薦）

Zeabur 提供簡單的一鍵部署，並內建 PostgreSQL 服務。

#### 步驟 1：建立專案

1. 登入 [Zeabur Dashboard](https://dash.zeabur.com)
2. 點擊 **Create Project**
3. 選擇區域（建議選擇靠近目標使用者的區域）

#### 步驟 2：新增 PostgreSQL 服務

1. 在專案中點擊 **Add Service**
2. 選擇 **Marketplace** → **PostgreSQL**
3. 等待資料庫啟動完成
4. 點擊 PostgreSQL 服務 → **Connection** 標籤
5. 複製 **Prisma URL**（格式為 `postgresql://...`）

#### 步驟 3：部署應用程式

1. 點擊 **Add Service** → **Git**
2. 連接你的 GitHub 帳號並選擇此 Repository
3. Zeabur 會自動偵測 Next.js 專案

#### 步驟 4：設定環境變數

在應用服務的 **Variables** 標籤中新增：

| 變數名稱 | 說明 |
|----------|------|
| `DATABASE_URL` | 貼上步驟 2 複製的 Prisma URL |
| `AUTH_SECRET` | 執行 `openssl rand -base64 32` 產生的隨機字串 |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `NEXT_PUBLIC_APP_URL` | 你的 Zeabur 網域，例如 `https://your-app.zeabur.app` |
| `NEXT_PUBLIC_SHORT_URL` | 短網址基底，例如 `https://your-app.zeabur.app/s` |
| `IP_HASH_SALT` | 任意隨機字串，用於 IP 匿名化 |
| `ALLOWED_EMAIL_DOMAIN` | （選填）限制可登入的 Email 網域 |

#### 步驟 5：設定網域

1. 在應用服務中點擊 **Networking** 標籤
2. 新增自訂網域或使用 Zeabur 提供的 `.zeabur.app` 子網域
3. **重要**：更新 Google OAuth 設定中的「已授權重新導向 URI」為：
   ```
   https://your-domain.com/api/auth/callback/google
   ```

#### 步驟 6：初始化資料庫

部署完成後，Zeabur 會自動執行 `npm run build`，其中會觸發 `prisma generate`。

如需手動推送 Schema，可在 Zeabur 的 **Console** 標籤執行：
```bash
npx prisma db push
```

---

### 其他部署平台

本應用相容任何支援 Next.js 的平台：

#### Vercel
```bash
npm i -g vercel
vercel
```
在 Vercel Dashboard 設定環境變數，並加入 PostgreSQL 整合（如 Neon、Supabase）。

#### Railway
1. 連接 GitHub Repository
2. 新增 PostgreSQL 服務
3. 設定環境變數
4. Railway 會自動部署

#### Docker
```bash
docker build -t shortlink-app .
docker run -p 3000:3000 --env-file .env shortlink-app
```

---

## 專案結構

```
src/
├── app/
│   ├── [locale]/              # 國際化路由
│   │   ├── (dashboard)/       # 受保護的儀表板路由
│   │   │   ├── dashboard/     # 總覽儀表板
│   │   │   ├── links/         # 連結管理
│   │   │   ├── templates/     # UTM 模板
│   │   │   ├── analytics/     # 數據分析
│   │   │   ├── users/         # 使用者管理
│   │   │   ├── audit-log/     # 審計日誌
│   │   │   └── settings/      # 設定
│   │   └── auth/              # 認證頁面
│   ├── api/                   # API 路由
│   ├── s/[code]/              # 短網址重導向處理
│   └── share/[token]/         # 公開分享報告頁面
├── components/
│   ├── layout/                # 版面元件
│   ├── forms/                 # 表單元件
│   ├── links/                 # 連結相關元件
│   └── analytics/             # 分析圖表元件
├── lib/
│   ├── auth.ts                # NextAuth.js 設定
│   ├── prisma.ts              # Prisma 客戶端
│   └── utils/                 # 工具函式
└── messages/                  # 翻譯檔案
```

---

## API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/links` | GET, POST | 列出 / 建立連結 |
| `/api/links/batch` | POST | 批次建立連結 |
| `/api/links/[id]` | GET, PATCH, DELETE | 單一連結操作 |
| `/api/analytics` | GET | 取得分析數據 |
| `/api/templates` | GET, POST | 列出 / 建立 UTM 模板 |
| `/api/templates/[id]` | GET, PATCH, DELETE | 單一模板操作 |
| `/api/share` | POST | 建立分享連結 |
| `/api/share/[token]` | POST | 驗證並取得分享報告 |
| `/api/users` | GET | 列出使用者（Admin） |
| `/api/users/[id]` | PATCH, DELETE | 使用者管理（Admin） |
| `/api/audit-log` | GET | 審計日誌（Admin/Manager） |

---

## 環境變數說明

| 變數 | 必填 | 說明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 連線字串 |
| `AUTH_SECRET` | 是 | NextAuth.js 加密金鑰 |
| `GOOGLE_CLIENT_ID` | 是 | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | 是 | Google OAuth Client Secret |
| `NEXT_PUBLIC_APP_URL` | 是 | 應用程式 URL |
| `NEXT_PUBLIC_SHORT_URL` | 是 | 短網址基底 URL |
| `IP_HASH_SALT` | 是 | IP 位址雜湊鹽值 |
| `ALLOWED_EMAIL_DOMAIN` | 否 | 限制登入網域 |
| `GEOIP_API_KEY` | 否 | 地理位置服務 API 金鑰 |

---

## 授權條款

Private - 僅供內部使用
