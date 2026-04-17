# ShortLink App — 環境變數設定指南

> 本文件說明 ShortLink App 部署至 Vercel 時所需的所有環境變數。
> 每個變數都包含：是什麼、為什麼需要、如何設定、注意事項。

---

## 在 Vercel 哪裡設定？

1. 登入 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇你的 ShortLink 專案
3. 左側選 **Settings**
4. 點擊 **Environment Variables**
5. 逐一新增以下變數，Environment 選擇 **Production + Preview + Development**

---

## 1. DATABASE_URL

### 是什麼

PostgreSQL 資料庫的連線 URI。Prisma ORM 透過這個連線字串存取所有資料：使用者、短網址、點擊記錄、Campaign 等。

### 為什麼需要

這是整個應用的核心資料來源。沒有 `DATABASE_URL`，應用無法啟動，所有頁面都會報 500 錯誤。

### 如何設定

**使用 Supabase（推薦）：**

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇你的 Project（或建立新的 → 選 **ap-southeast-1** 區域離台灣最近）
3. 左側選 **Project Settings** → **Database**
4. 往下找到 **Connection string** 區塊
5. 選擇 **URI** tab
6. 複製整段連線字串
7. 把 `[YOUR-PASSWORD]` 替換成你建立 Project 時設定的 database password

**格式範例：**

```
postgresql://postgres.[project-ref]:[your-password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

**首次部署後，需要推送 Schema 到資料庫：**

```bash
# 在本地執行（確保 .env 裡有正確的 DATABASE_URL）
npx prisma db push
```

### 注意事項

- **連線模式**：Supabase 提供兩種連線方式 — **Transaction mode**（port 6543，適合 serverless）和 **Session mode**（port 5432）。Vercel serverless 請用 **Transaction mode (port 6543)**
- **密碼安全**：database password 只在建立時顯示一次，忘記的話需要在 Supabase Dashboard 重設
- **不要用 Direct connection**：serverless 環境使用 direct connection 會很快耗盡連線數，一定要用 pooler 連線（supabase.com 的 URI 預設就是 pooler）

---

## 2. AUTH_SECRET

### 是什麼

NextAuth.js 用來加密 session token、CSRF token 和 cookie 的密鑰。是一組隨機的 Base64 字串。

### 為什麼需要

沒有 `AUTH_SECRET`，NextAuth 無法安全地管理使用者登入狀態。使用者無法登入，所有受保護的頁面都無法存取。

### 如何設定

在終端機執行：

```bash
openssl rand -base64 32
```

輸出範例：

```
K7x2Qf3mNp8Lj1Rv5Yt9Wz4Xa6Bc0De2Fg7Hi3Jk=
```

把輸出直接貼到 Vercel 的 Value 欄位。

### 注意事項

- **每個環境用不同的值** — Production 和 Preview 建議用不同的 `AUTH_SECRET`，避免 token 交叉使用
- **更改會登出所有人** — 如果你更換 `AUTH_SECRET`，所有現有的 session 都會失效，使用者需要重新登入
- **不要用簡單字串** — 一定要用 `openssl rand` 產生的隨機值，不要手打 "my-secret-key" 之類的

---

## 3. GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET

### 是什麼

Google OAuth 2.0 的憑證，讓使用者可以用 Google 帳號登入 ShortLink App。`CLIENT_ID` 是公開的識別碼，`CLIENT_SECRET` 是伺服器端的密鑰。

### 為什麼需要

ShortLink App 目前只支援 Google OAuth 登入，沒有這兩個值，登入按鈕會失效，使用者無法進入系統。

### 如何設定

**Step 1 — 進入 Google Cloud Console**

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 上方選擇或建立一個 Project

**Step 2 — 設定 OAuth Consent Screen（首次才需要）**

1. 左側選 **APIs & Services** → **OAuth consent screen**
2. User Type 選 **External** → Create
3. 填寫：
   - App name: `ShortLink`（或你想要的名稱）
   - User support email: 你的 email
   - Developer contact email: 你的 email
4. 其他全部跳過，一路點 Save and Continue 到完成

**Step 3 — 建立 OAuth Client ID**

1. 左側選 **APIs & Services** → **Credentials**
2. 點上方 **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Application type 選 **Web application**
4. Name 填 `ShortLink App`
5. **Authorized JavaScript origins** 加入：
   - `http://localhost:3000`
   - `https://你的專案名.vercel.app`
6. **Authorized redirect URIs** 加入：
   - `http://localhost:3000/api/auth/callback/google`
   - `https://你的專案名.vercel.app/api/auth/callback/google`
7. 點 **Create**
8. 彈窗會顯示 **Client ID** 和 **Client Secret** — 分別複製

### 注意事項

- **Redirect URI 必須完全匹配** — 包含 protocol（https）、domain、path，少一個字元都會導致 "redirect_uri_mismatch" 錯誤
- **自訂 domain** — 如果你在 Vercel 上綁定了自訂 domain（例如 `sl.mycompany.com`），redirect URI 也要加上 `https://sl.mycompany.com/api/auth/callback/google`
- **測試狀態 vs 正式發布** — OAuth consent screen 在 "Testing" 狀態時，只有你手動加入的測試帳號能登入。要讓所有人都能登入，需要點 **PUBLISH APP**（不需要 Google 審核，除非你用了敏感 scope）
- **Secret 不可外洩** — `GOOGLE_CLIENT_SECRET` 只能放在 Vercel 環境變數或 `.env.local`，絕對不要 commit 到 git

---

## 4. NEXT_PUBLIC_APP_URL

### 是什麼

應用的公開 URL，用於 NextAuth 產生 callback URL、email 裡的連結等。`NEXT_PUBLIC_` 前綴表示這個值會暴露在前端 JavaScript 中。

### 為什麼需要

NextAuth 需要知道應用的完整 URL 才能正確處理 OAuth redirect。如果設錯，登入後會 redirect 到錯誤的網址。

### 如何設定

| 環境 | 值 |
|------|-----|
| 本地開發 | `http://localhost:3000` |
| Vercel（預設 domain） | `https://你的專案名.vercel.app` |
| Vercel（自訂 domain） | `https://sl.mycompany.com` |

### 注意事項

- **不要加結尾斜線** — `https://example.com` 而不是 `https://example.com/`
- **必須包含 protocol** — `https://` 不能省略
- **`NEXT_PUBLIC_` 前綴** — 這個值會出現在前端打包的 JS 中，不要把敏感資訊放在這裡（但 URL 本身不算敏感）

---

## 5. NEXT_PUBLIC_SHORT_URL

### 是什麼

短網址的完整前綴。UI 上顯示短網址、產生 QR Code、複製連結時都會用到這個值。

### 為什麼需要

使用者在 Dashboard 看到的短網址 `https://sl.mycompany.com/s/abc123` 的 `https://sl.mycompany.com/s` 部分就來自這個變數。如果不設定，UI 會顯示 `domain.com/s/abc123`（預設佔位符）。

### 如何設定

| 環境 | 值 |
|------|-----|
| 本地開發 | `http://localhost:3000/s` |
| Vercel（預設 domain） | `https://你的專案名.vercel.app/s` |
| Vercel（自訂 domain） | `https://sl.mycompany.com/s` |

### 注意事項

- **結尾不加 `/`** — `https://example.com/s` 而不是 `https://example.com/s/`
- **必須包含 `/s` 路徑** — 所有短網址都在 `/s/[code]` 路徑下
- **如果你用短 domain** — 例如 `https://sho.rt/s`，那短網址就會是 `sho.rt/s/abc123`，非常簡潔

---

## 6. IP_HASH_SALT

### 是什麼

一組隨機的 hex 字串，用來對使用者的 IP 地址做 SHA-256 雜湊。系統不會儲存原始 IP，只儲存雜湊值。

### 為什麼需要

**隱私保護** — GDPR 和各地隱私法規要求不能直接儲存使用者 IP。透過加 salt 的 SHA-256 雜湊，我們可以做到：

- 判斷同一個 IP 是否在 10 秒內重複點擊（去重）
- 計算獨立訪客數
- 無法從雜湊值反推出原始 IP

### 如何設定

在終端機執行：

```bash
openssl rand -hex 32
```

輸出範例：

```
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

把輸出貼到 Vercel 的 Value 欄位。

### 注意事項

- **Production 必填** — 如果沒設定，所有 redirect（`/s/[code]`）都會在點擊記錄階段報錯。redirect 本身仍會正常運作（click 記錄在背景執行），但不會有任何分析數據
- **設定後不要更改** — Salt 改了之後，同一個 IP 會產生不同的 hash。導致：
  - 去重邏輯失效（同一個人的連續點擊會被重複計算）
  - 獨立訪客數突然暴增（歷史的 hash 對不上了）
- **不可外洩** — 如果 salt 洩漏，攻擊者可以用彩虹表反推 IP 地址
- **每個環境用不同的值** — Production 和 Preview 建議用不同的 salt

---

## 7. ALLOWED_EMAIL_DOMAIN（選填）

### 是什麼

限制只有特定 email 網域的 Google 帳號才能登入。例如設成 `mycompany.com`，只有 `xxx@mycompany.com` 的帳號能登入。

### 為什麼需要

如果你的 ShortLink 是公司內部工具，不想讓外部人員用個人 Gmail 登入，就需要這個限制。

### 如何設定

在 Vercel 環境變數中加入：

```
ALLOWED_EMAIL_DOMAIN=mycompany.com
```

- 只填 domain，不要加 `@`
- 只支援單一 domain

### 注意事項

- **不設定 = 所有 Google 帳號都能登入** — 如果你不需要限制，就不要設定這個變數
- **設錯 domain 會鎖死所有人** — 確認拼寫正確。如果設錯了，需要到 Vercel Dashboard 修改環境變數後重新部署
- **不支援多 domain** — 目前只能限制一個 domain。如果需要多個，需要修改程式碼

---

## 快速設定 Checklist

| # | 變數 | 必填 | 取得方式 | 需要帳號 |
|---|------|------|---------|---------|
| 1 | `DATABASE_URL` | 必填 | Supabase Dashboard | Supabase |
| 2 | `AUTH_SECRET` | 必填 | `openssl rand -base64 32` | 無 |
| 3 | `GOOGLE_CLIENT_ID` | 必填 | Google Cloud Console | Google |
| 4 | `GOOGLE_CLIENT_SECRET` | 必填 | Google Cloud Console | Google |
| 5 | `NEXT_PUBLIC_APP_URL` | 必填 | 你的 Vercel URL | 無 |
| 6 | `NEXT_PUBLIC_SHORT_URL` | 必填 | 你的 Vercel URL + `/s` | 無 |
| 7 | `IP_HASH_SALT` | 必填 | `openssl rand -hex 32` | 無 |
| 8 | `ALLOWED_EMAIL_DOMAIN` | 選填 | 自行決定 | 無 |

---

## 部署後驗證

設定完所有環境變數並部署後，依序檢查：

1. **首頁能載入** → `DATABASE_URL` 正確
2. **能用 Google 登入** → `AUTH_SECRET` + `GOOGLE_CLIENT_*` + `NEXT_PUBLIC_APP_URL` 正確
3. **Dashboard 顯示正常** → 資料庫連線正常
4. **建立一條短網址並點擊** → `IP_HASH_SALT` 正確
5. **Analytics 有顯示點擊記錄** → 完整流程正常運作
6. **UI 上的短網址顯示正確的 domain** → `NEXT_PUBLIC_SHORT_URL` 正確
