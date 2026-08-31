# 架構與資料流 — Short Link Manager

> 從 CLAUDE.md 拆出。各節摘要見 [CLAUDE.md](../CLAUDE.md)。

## 1. Route A — Campaign-centric navigation（心智模型）

Sidebar 順序 = 使用者心智模型（高頻→低頻）：
**Campaigns → Links → Analytics → Templates → Users / Audit Log**

登入導向 **`/campaigns`**（Dashboard 已刪）。三頁各自職責：

- **Campaigns 列表** = 活動管理駕駛艙。Leaderboard（clicks / conv / CVR / goal%），勾選 2-4 個 → overlay 折線 / `/campaigns/compare` side-by-side
- **Campaign Detail**（`/campaigns/[name]`）= 單活動「指揮中心」，3 tabs：
  - **Overview** — KPI 目標 + 30d 趨勢折線
  - **Traffic** — top sources / mediums / devices / countries / referrers（透過 `computeAnalytics(raw, { campaign })` 過濾）
  - **Links** — 該活動的所有連結 + 每條 conversion / CVR
- **Analytics** = 純「全站維度分析」（device / browser / OS / geo / referrer / UTM 交叉表）。**沒有** campaign leaderboard — 那是 Campaigns 的事

## 2. Conversion attribution（`/api/track` + `/track.js`）

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

## 3. A/B 變體

- `ShortLink.variants: Json`（`{id, url, weight, label?}[]`）
- `lib/variants.ts` — `parseVariants()` + `pickVariant()` weighted random
- 轉址路徑：variants 空 → 用 `originalUrl`；有 → weighted pick + `Click.variantId` 記錄
- Edit form 有 variant editor（label + URL + weight + 即時百分比）

## 4. Campaign auto-link

使用者填 `utmCampaign = "spring_sale"` → `lib/campaign-autolink.ts` 在 POST/PATCH/batch-csv 都自動 upsert Campaign row（`status=ACTIVE`）+ 設 `ShortLink.campaignId`。解掉「我填了 UTM 為什麼 Campaigns 頁空的」認知 gap（Bitly / Dub.co pattern）。Backfill script：`scripts/backfill-campaign-autolink.mjs`。

`Campaign` 有 `@@unique([workspaceId, name])`（2026-08-31 加）。在那之前 `upsertCampaignForUtm()` 的 findFirst-then-create 會 race：兩個併發的建立連結請求帶同一個 utm_campaign 會同時 miss 查詢、同時 insert，把一個活動拆成兩列 leaderboard。helper 的 catch 區塊本來就在等這個約束。**新增建立 Campaign 的路徑時要處理 P2002**（`/api/campaigns` POST 用 workspace-scoped 的 409 前置檢查，`/api/utm-campaigns/[name]` PATCH 用 catch + findFirst fallback）。

Postgres 視 NULL 為相異值，所以 `workspaceId=NULL` 的 orphan 不受約束 — helper 對那種情況改用 name + createdById 比對。

維運腳本：`scripts/merge-duplicate-campaigns.mjs`（同名重複自動合併；不同拼法的別名要在 `ALIASES` 明列）。

## 5. Client-side Data Caching (React Query) ⭐

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

## 6. 兩層 cache：Server (Redis) + Client (React Query)

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

## 6b. 列表頁做「client-side filter」

`/links`、`/campaigns`、`/analytics` 都是抓一次完整資料，client 用 `useMemo` 過濾 / 排序 / 聚合 — 切 filter 零網路。結合上面的 React Query cache，就是「打 1 次 API、後續無限互動零延遲」。

## 7. Auth + Workspace（DB-driven）

整個 user management 已從 env-var 白名單 → 移到 DB。`ALLOWED_EMAILS` 還在但只當過渡 fallback，正式規則在 `lib/auth.ts` signIn callback：

```
signIn 允許條件（first-match-wins）：
  1. BOOTSTRAP_EMAILS env（1–2 個緊急 admin，緊急開機用）
  2. WorkspaceMember 存在     → 既有成員
  3. PENDING WorkspaceInvitation + 未過期 → 被邀請的新人
  4. ALLOWED_EMAILS env       → 過渡相容，等所有人都正式邀請進來後可刪
```

**`events.signIn` 自動 accept**：使用者首次 OAuth 成功後，hook 找出該 email 所有 PENDING invitation 一次 accept，建好 WorkspaceMember。所以**口頭通知 + 直接登入** 跟 **點 invite link** 兩條路效果一樣 — 連結只是便利性。

**權限判斷有兩個層級，都在 `lib/workspace.ts`：**

```
① Resource 層級 — canUserActOnResource(userId, { createdById, workspaceId })
     編輯 / 刪除 / clone / share 某一筆資源時用
     - 是建立者 → 永遠 yes
     - 在 resource workspace 是 OWNER/ADMIN → yes（admin override）
     - 其他 → no
     - workspaceId=NULL 的 orphan → 只有建立者能動

② Workspace 層級 — isWorkspaceAdmin(role) + resolveWorkspaceAccess(request, session)
     不綁定單一資源的管理權（治理設定、稽核紀錄、成員管理）時用
     - resolveWorkspaceAccess 回傳 { workspaceId, role }，
       fallback 邏輯與 resolveWorkspaceScope 相同
     - isWorkspaceAdmin(role) → role 是 OWNER 或 ADMIN
```

**所有 API 的權限檢查都用這兩個。** 絕對不要用 `session.user.role` — `User.role` 是 legacy 全域旗標，跟 workspace 角色完全脫鉤。實際資料裡**每個使用者的 `User.role` 都是 `MEMBER`，包含 workspace OWNER**，所以任何 `["ADMIN","MANAGER"].includes(session.user.role)` 形式的檢查等於「拒絕所有人」。2026-08-31 修掉了 `/api/workspace/utm-settings` PATCH 和 `/api/audit-log` GET 這兩個踩到的端點（詳見 Pitfalls #21 / #26）。

**`resolveWorkspaceScope` 的 auto-fallback**：client 沒送 `x-workspace-id` header（race condition：fetch 在 WorkspaceContext 載入前就發出）時，server 自動查使用者最早加入的 workspace 補上，不再產生 `workspaceId=NULL` 的 orphan。配合下面的 fetch patch 兩道防線。

**Client 端 `lib/fetch-workspace.ts`**：在 `Providers.tsx` 模組載入時 patch `window.fetch`，對同站 `/api/*`（略過 `/api/auth/*`）自動塞 `x-workspace-id` header（從 localStorage 讀 `shortlink-current-workspace`）。Workspace 切換時下個 request 自動帶新 id，無需 remount。

**Workspace scoping 只有一條路：`resolveWorkspaceScope()`。** 舊的 `buildWorkspaceWhere()` 已於 2026-08-31 刪除（最後一個呼叫點是 `/api/analytics`）。

⚠️ **任何吃 `linkId` / `campaignId` 之類 id 參數的 endpoint，都要把 id 併入 scoped 查詢當額外條件，不能拿 id 取代 scope 過濾** — 否則就是 IDOR，任何登入者猜到 id 就能讀別的 workspace 的資料。正確寫法：

```ts
const scoped = await prisma.shortLink.findMany({
  where: linkId ? { ...whereLinks, id: linkId } : whereLinks,   // ✅
  select: { id: true },
});
// ❌ 絕對不要：if (linkId) whereClicks.shortLinkId = linkId;
```

`/api/analytics` 和 `/api/export/analytics` 都踩過這個坑（前者 2026-08-31 修）。

## 8. UTM 建構器 + 白名單

- `UTMBuilder.tsx` 從 `/api/workspace/utm-settings` 讀 approved sources/mediums，放 datalist 優先順
- 打了非白名單值 → 即時 amber warning（還是能送，server 側會回 400）
- Server-side enforcement：`lib/utm-governance.ts::validateUtmAgainstGovernance()` 在 POST/PATCH/batch/batch-csv 都檢查
- 欄位有值時右邊顯示 **X 清除鍵**（不是 ChevronDown）— 否則 datalist 有值會自動過濾、看起來像壞掉

## 9. Custom domain (`go.engenius.ai`) + middleware

`NEXT_PUBLIC_SHORT_URL` ≠ `NEXT_PUBLIC_APP_URL` 時 middleware 啟動短域名守護（`src/middleware.ts`）：

| URL | 行為 |
|---|---|
| `go.engenius.ai/<code>` | **Internal rewrite** → `/s/<code>`（既有 redirect handler）— 短網址直接掛根目錄 |
| `go.engenius.ai/s/*`、`/link-*`、`/track.js`、`/api/track` | 直接 pass through |
| `go.engenius.ai/*`（其他） | **302 → engeniustech.com**（不暴露 dashboard / sign-in / API） |
| `mkt-shortlink.vercel.app/*` | 正常走 next-intl |

兩 env 相同時是 no-op（適合本機 / 還沒接 custom domain 的 staging）。

## 10. Kickstart wizard（活動啟動器）

`/campaigns/kickstart`：選 playbook（Product Launch / Exhibition Event）→ 自動展開 8–10 個頻道的 checklist（每個頻道一條 link，預填 source/medium/content）→ 一鍵 sequential POST `/api/links` 建完。

**擴充模式**：使用者輸入既有 utm_campaign 名稱時，wizard query `/api/links?campaign=<name>` 找出已建頻道，自動 uncheck 對應列（用 `useRef` 確保只 auto-uncheck 一次，不會 stomp 使用者手動切換）。完全成功的列在 submit 後也自動 uncheck，避免 partial-failure retry 重複建立。

Playbook 定義在 `lib/campaign-playbooks.ts`；name / description / channel label 走 i18n key `kickstartPlaybooks.{id}.channels.{id}.{label|hint}`。

## 11. Mobile responsive baseline

不是完整 mobile-first 重設計，是「行銷同事可以查 + 簡單建立」的 baseline。覆蓋：

- `src/app/layout.tsx` 設 viewport meta（device-width + initialScale=1）
- `globals.css` mobile fallback 區塊：`.table-scroll` wrapper、`.grid-resp-2`、`.tbl-wrap` 改 `overflow-x: auto`、`.page-head` / toolbar 在 ≤768px wrap、按鈕觸控 ≥40px / ghost ≥44px
- `LinkMobileCard.tsx` + `useMediaQuery` — `/links` 在 ≤768px 切換成 card view（標題、短網址、UTM pills、status、clicks 直立排列）
- KPI tile 用 `.kpi-row-3` className（不是 inline `gridTemplateColumns`），媒體查詢能生效
- `SyncButton` 的「Last synced」label 用 `.sync-button-label` class，mobile 隱藏

## 12. 測試點擊標記與軟重設

團隊自己測連結會污染數據，但直接刪 Click row 不可逆。所以走「標記」而非刪除：

- `Click.isInternal`（Boolean）— 標為測試點擊，analytics 預設過濾掉，UI 有 toggle 可切回來看
- `Click.resetBatchId`（String?）— 一次「重設活動點擊」的批次 id。同一批可以整批還原

「重設活動點擊」（`/api/utm-campaigns/[name]/reset-clicks`）不刪資料，是把該活動所有 Click 標上 `isInternal=true` + 同一個 `resetBatchId`。Audit action 有 `RESET_CAMPAIGN_CLICKS` / `RESTORE_CAMPAIGN_CLICKS` 兩種。

站內說明頁在 `/notes/test-clicks`（footer 有連結），解釋這個機制給行銷同事看。

## 13. CSV 匯出

三個 endpoint 共用 `csvResponse()` helper：

| Endpoint | 內容 |
|---|---|
| `/api/export/links` | 連結明細 |
| `/api/export/analytics` | 點擊原始紀錄（吃 `linkId` / `campaign` 參數） |
| `/api/export/campaigns` | 跨活動比較 / 每日長表（日期 × 連結）/ 單一活動的連結明細 |

「每日長表」是給行銷同事丟進樞紐分析或 Looker Studio 用的 tidy format — 一列一個「日期 × 連結」組合，不是寬表。

## 14. Analytics 進階指標

`/analytics` 除了基本維度，還有三個 P1 指標：

- **點擊衰減曲線（golden window）** — 從該活動第一次點擊起算的逐時累積 + 每小時點擊。**只在 filter 到單一 campaign 或 link 時才顯示**（全站混在一起沒有意義）
- **7×24 熱度圖** — 星期 × 小時。⚠️ 用的是 **viewer 瀏覽器時區**，不是 UTC 也不是 workspace 時區
- **城市排行** — GeoIP 解析，前 15 名。準確度依地區差異很大，UI 上有註明
