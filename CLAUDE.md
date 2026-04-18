# CLAUDE.md — Project Context

> Last updated: 2026-04-18

## Project Overview

行銷部專用短網址 + UTM 追蹤工具。團隊建連結、共用 UTM 規範、看點擊分析。
功能清單與產品定位詳見 [README.md](README.md)。

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + TypeScript (strict)
- **Prisma 6** ORM → **PostgreSQL** via **Supabase** (ap-northeast-1)
- **NextAuth.js v5** (Google OAuth) + `@auth/prisma-adapter`
- **Upstash Redis**（選配快取，有 graceful fallback）
- Tailwind CSS 4、Recharts、next-intl、Zod、lucide-react
- 部署：**Vercel** (Hobby plan) — GitHub 自動部署

## Directory Structure

```
src/
├── app/[locale]/
│   ├── (dashboard)/
│   │   ├── {page}/page.tsx         # Server Component（async, 直接用 Prisma 拉初始資料）
│   │   ├── {page}/{Page}Client.tsx # Client Component（接收 initial 資料當 prop, 處理互動）
│   │   ├── {page}/loading.tsx      # Next.js 原生 skeleton
│   │   └── loading.tsx             # 通用 dashboard fallback
│   └── auth/                       # signin / error 頁
├── app/api/
│   ├── analytics/route.ts          # 舊的（已聚合）— 保留給 export/share 用
│   ├── analytics/raw/route.ts      # 新的（raw clicks）— 給 client-side 聚合用
│   └── {其他資源 routes}
├── app/s/[code]/route.ts           # 短網址轉址 + click 記錄
├── components/forms/UTMBuilder.tsx # 核心 UTM 欄位表單（datalist combobox）
├── lib/
│   ├── analytics/compute.ts        # ⭐ Client-side 聚合函式（純 JS）
│   ├── cache.ts                    # Redis wrapper（graceful fallback）
│   ├── auth.ts                     # NextAuth 設定 + email 白名單
│   ├── workspace.ts                # buildWorkspaceWhere() 權限 where 條件
│   ├── prisma.ts                   # Prisma singleton
│   └── utils/utm.ts                # UTM 常數 + medium/source 對照
├── messages/{en,zh-TW}.json        # i18n
└── middleware.ts                   # next-intl routing
prisma/schema.prisma                # 含 @@index — FK 索引不自動建
```

## Architecture & Data Flow

### 1. Client-side Filter 架構（2026-04 重構後的主模式）

**適用頁**：`/analytics`、`/links`、`/campaigns`

```
Server Component (page.tsx)
  ↓ Prisma 一次撈完整資料
Client Component ({Page}Client.tsx)
  ↓ initialXxx 當 props 傳入
  ↓ useMemo 過濾 / 排序 / 聚合 （切 filter 零網路）
  ↓ 只有 CRUD mutation 才 refresh
Render
```

- `/links`：上限 500 條（`LINK_CAP`），超過顯示 amber banner
- `/analytics`：上限 10,000 clicks、90 天範圍（`DAYS_WINDOW` / `CLICK_CAP` in `api/analytics/raw/route.ts`）
- `/campaigns`：載入全部（含 ARCHIVED），client 過濾

**不再需要** debounced search / re-fetch on filter — 全部 useMemo。

### 2. Two-layer Cache

```
Request → Browser (Cache-Control max-age) → Redis (60s TTL) → Postgres
```

- Redis wrapper 在 `lib/cache.ts`，無 env vars 時自動 no-op
- Cache key 格式：`cacheKey("scope", userId, workspaceId, ...filters)`
- 目前有 cache：`/api/analytics`、`/api/analytics/raw`、`/dashboard` server-side
- Browser cache（private, max-age）設在所有 GET API route

### 3. Workspace / Auth

- `auth()` 回 session; `buildWorkspaceWhere(wsId, userId, role)` 產 Prisma where
- 沒指定 workspace → ADMIN/MANAGER 看全部、MEMBER/VIEWER 只看自己
- 登入白名單：`ALLOWED_EMAILS` env（逗號分隔），邏輯在 `lib/auth.ts` signIn callback

### 4. UTM 建構器

- `UTMBuilder.tsx` 的 medium / source 用 `<datalist>` combobox（可選可打）
- 值存 raw value（`google`, `cpc`），但 datalist 用 `label=` 顯示「Google Ads」
- 欄位有值時右邊顯示 **X 清除鍵**（非 ChevronDown）— 否則 datalist 會自動過濾、看起來像壞掉
- `getSourceOptionsForMedium()` / `getMediumContext()` 在 `lib/utils/utm.ts`

## Conventions

### Server / Client split 命名

- Server page 永遠叫 `page.tsx`（async function）
- Client 元件叫 `{Page}Client.tsx`（PascalCase，與資料夾同名）
- Client 的 `isInitialMount` / `hasInitialFetch` ref 模式已**不再用**（client-side filter 不需要）

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

### i18n

- 所有使用者看到的文字都要走 `next-intl` 的 `t()`
- 新增 i18n key 要同時改 `messages/en.json` + `messages/zh-TW.json`

### Column naming

Prisma schema 用 camelCase（`userId`），但 DB 欄位名是 snake_case（`user_id`）— 靠 `@map`。寫 raw SQL 要用 snake_case。

## Current Status

功能清單詳見 [README.md](README.md)。

### 🔜 Next Steps / Pending

- **Secret rotation**：部署過程中 Supabase password / Google OAuth secret / Upstash token 都曾貼在對話裡 → 建議 rotate 一輪
- `/api/tags`、`/api/links`、`/api/campaigns` 的 Redis cache 尚未加（目前只有 browser cache）— 如果需要再做
- Dashboard 目前沒 filter，未來若加日期範圍 filter 可套 client-side pattern

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

必填：`DATABASE_URL` (pooler) / `DIRECT_URL` / `AUTH_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SHORT_URL` / `IP_HASH_SALT`
選填：`ALLOWED_EMAILS`、`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`

Prisma datasource 需 `directUrl` 才能讓 `db push` 繞過 pgbouncer — schema 已設好。

## Common Pitfalls

1. **Fire-and-forget 在 Vercel 會被砍** — Lambda 一送 response 就 kill pending promises。任何 cache 寫入、log、side effect 必須 `await`。我們就是踩過這個坑才改掉 `cacheSet().catch()`。

2. **Supabase Free tier 上限 2 active projects** — 建第 3 個會失敗。若超限要先 pause/delete。

3. **Datalist 有值時會過濾自己** — HTML `<input list>` 當 input 有值，datalist 會只剩匹配項，看起來「下拉空了」。我們改用 X 清除按鈕處理，**新增類似欄位時要一起做**。

4. **`private` + `s-maxage` 無效** — Cache-Control `s-maxage` 在 `private` 時被忽略。browser-only cache 用 `max-age`。

5. **Next.js 16 searchParams 是 Promise** — Server Component 要 `await searchParams`。

6. **Prisma groupBy() 在 `Promise.all` 中並行** — 之前 analytics 拆成 5 波 sequential await，效能很差。已整合成 1 個 Promise.all 包 12 個查詢。新增聚合時請**加進現有 Promise.all**，別另外 await。

7. **Client-side filter 有資料上限** — 別忘了當資料超過 cap 時顯示 banner。目前 `/links` cap=500，`/analytics` cap=10000 clicks + 90 天。

8. **Column 命名不一致** — Prisma model 欄位是 camelCase，DB column 是 snake_case。Raw SQL（`$queryRaw`）要用 snake_case；Prisma ORM API 用 camelCase。

9. **Click record 用 `after()` API** — `src/app/s/[code]/route.ts` 用 Next.js 15+ 的 `after()` 保證轉址不被 click 紀錄拖慢。別改回 sync。
