# CLAUDE.md — 專案背景知識

> 每次開新 session 時，AI 請先完整讀取此檔案，再讀取 `REVIEW_PLAN.md` 與 `PRODUCT_BRIEF.md`。

---

## 專案簡介

**Shortlink App** — 企業級短連結管理平台，支援多工作區、UTM 追蹤、Analytics、Campaign 管理、QR Code、稽核日誌。

- **前端 / 後端**：Next.js 15 App Router（`/src/app`），TypeScript
- **資料庫 ORM**：Prisma 6（PostgreSQL）
- **驗證**：NextAuth 5 beta（Google OAuth）
- **i18n**：next-intl，支援 `en` / `zh-TW`（`/messages/`）
- **部署**：Zeabur（`start_command: "prisma db push && node .next/standalone/server.js"`）

---

## 目錄結構

```
src/
  app/
    [locale]/              # i18n 包裝層（en / zh-TW）
      (dashboard)/         # 已登入的 dashboard 路由群組
        dashboard/         # 首頁 / Now panel
        links/             # 短連結管理
        analytics/         # 分析儀表板
        campaigns/         # Campaign 列表
        campaigns/[name]/  # Campaign 詳情 + KPI 進度條
        settings/          # 工作區設定（含 UTM Rules tab）
        templates/         # UTM 範本
        audit-log/
        users/
        workspaces/
    api/
      links/               # 短連結 CRUD + batch-actions
      analytics/           # Analytics 查詢（支援 tagId / campaign / linkId）
      campaigns/           # Campaign CRUD
      utm-campaigns/       # UTM Campaign 統計 + KPI
      utm-campaigns/[name] # GET + PATCH goalClicks
      tags/                # Tag CRUD
      workspace/
        utm-settings/      # GET + PATCH UTM 命名規範（Admin/Manager only）
      share/               # 分享報告
      audit-log/
      export/
      invitations/
      templates/
      users/
      workspaces/
  components/
    forms/
      CreateLinkForm.tsx   # 建立短連結（含 UTM Builder + 治理警告）
      BatchCreateForm.tsx  # 批次建立
      UTMBuilder.tsx       # UTM 參數表單元件
      ConfirmDialog.tsx    # 刪除/操作確認對話框
    Toast.tsx              # 全站 toast 通知
  lib/
prisma/
  schema.prisma            # 資料庫 schema
messages/
  en.json
  zh-TW.json
```

---

## Prisma 重要慣例

### 正確 Model 名稱（易混淆）

| 正確 | 錯誤（別用） |
|------|-------------|
| `prisma.tagOnLink` | `prisma.linkTag` |
| `prisma.tagOnCampaign` | `prisma.campaignTag` |

### TagOnLink 的複合 PK

```ts
// 正確
prisma.tagOnLink.upsert({
  where: { shortLinkId_tagId: { shortLinkId: linkId, tagId } },
  create: { shortLinkId: linkId, tagId },
  update: {},
})

// 欄位名稱是 shortLinkId，不是 linkId
```

### Schema 關鍵欄位

- `ShortLink.code` — 短碼（slug）
- `ShortLink.workspaceId` — 工作區關聯
- `Campaign.goalClicks Int?` — KPI 目標點擊數（可為 null）
- `Workspace.utmSettings Json?` — UTM 命名規範 `{ approvedSources: string[], approvedMediums: string[] }`

---

## API 慣例

所有 API Route 位於 `/src/app/api/`，使用 Next.js 15 Route Handlers：

```ts
// 取得 session 與 workspace
const session = await getServerSession(authOptions)
const { searchParams } = new URL(request.url)
const workspaceId = searchParams.get("workspaceId")
```

- 驗證用 **Zod** schema
- 角色檢查：`session.user.role`（`ADMIN` / `MANAGER` / `MEMBER` / `VIEWER`）
- UTM Settings 寫入僅限 `["ADMIN", "MANAGER"].includes(role)`

---

## 目前功能狀態

### ✅ 已完成（Phase 1–3）

- 短連結 CRUD、Clone、Preview、批次操作（刪除/暫停/封存/標籤）
- **Toast 通知系統**（全站統一）
- **ConfirmDialog 確認對話框**（刪除/角色變更）
- **Slug 可用性即時檢查**（debounce）
- Campaign 管理 + **KPI 目標點擊數**（進度條、達標提示）
- **Analytics 三層篩選**：Campaign → Tag → 單一 Link
- **UTM 命名規範治理**（Settings → UTM Rules，Admin/Manager）
- 建立連結時 UTM 非核准值警告 badge
- QR Code（PNG/SVG 匯出）
- CSV 匯出（連結 + Analytics）
- 稽核日誌（全站操作記錄）
- 分享報告（token + 密碼 + 觀看次數限制）
- i18n（en / zh-TW）
- 角色權限（ADMIN / MANAGER / MEMBER / VIEWER）

### ⚠️ 待完成 / 已知缺陷

- **F1** Workspace 邀請 Email 未實作（DB + API 有，但 Email 發送缺）
- **F3** 多數 API 未按 workspace 過濾（技術債）
- **F4** GeoIP 地理位置追蹤未實作
- **F5** Loading skeleton 未實作
- **T3** Rate Limiter 為 in-memory（多實例無效，應改 Redis）
- **T5** 部署用 `prisma db push`（非 `migrate deploy`，有 schema 版控風險）
- **T7** 無任何測試（0 coverage）

---

## 部署說明（Zeabur）

```json
// zeabur.json
{
  "build_command": "npm run build",
  "start_command": "prisma db push && node .next/standalone/server.js"
}
```

- Schema 變更（additive）**只需 push 程式碼到 Zeabur**，`prisma db push` 會自動執行
- 本地沒有 `node_modules`，無法在本地跑 Prisma CLI
- `npm run db:push` = `prisma db push`（本地開發用，需先 `npm install`）

---

## 開發分支

- 目前主要開發分支：`claude/shortlink-uiux-review-Nj5ri`
- Push 時固定用：`git push -u origin <branch-name>`
- Branch 命名規則：`claude/<feature>-<sessionId>`

---

## 相關文件

| 檔案 | 說明 |
|------|------|
| `REVIEW_PLAN.md` | 完整功能審查報告（18 項建議、8 項技術建議、評分） |
| `PRODUCT_BRIEF.md` | 英文產品規格（IA、Data Model、功能說明） |
| `docs/product-brief.md` | 中文產品規格（使用者導向） |

---

## 常見陷阱

1. **不要用 `prisma.linkTag`**，正確是 `prisma.tagOnLink`（欄位 `shortLinkId`）
2. **i18n 字串**：所有 UI 文字必須走 `useTranslations()` hook，不要 hardcode 中英文
3. **Route Group**：Dashboard 頁面都在 `src/app/[locale]/(dashboard)/`，括號是 Next.js route group 語法，不會出現在 URL
4. **Analytics API** 支援 `tagId` / `campaign` / `linkId` 三個篩選 query params
5. **UTM Settings** 儲存在 `Workspace.utmSettings`（JSON），key 為 `approvedSources` / `approvedMediums`
