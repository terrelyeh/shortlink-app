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
| `["analytics-raw", "real-only" \| "with-internal"]` | 730 天 × 10k 筆 raw clicks（~2MB；`real-only` 已排除測試與疑似掃描點擊） | `/analytics`、Campaign Detail、Compare、Kickstart（目標參考值） |
| `["campaigns-summary", window]` | leaderboard / 時序 / orphans | `/campaigns`、Compare |
| `["links", 500]` | 連結列表（含 trend、`createdBy`；Redis key `links-list-v4`） | `/links` |
| `["links-trash"]` | 已軟刪除的連結（上限 200） | `/links/trash`；刪除後由 LinksClient invalidate |
| `["campaign-links", name, "real-only" \| "with-internal"]` | 某活動下的 links（快取形狀是**陣列**） | Campaign Detail、Kickstart（既有活動模式） |
| `["campaign-goal", name]` | `/api/utm-campaigns/[name]` 的活動紀錄：goal / goalByMedium / 期間 / 狀態 / 負責人（key 名稱是歷史包袱） | Campaign Detail |
| `["workspace-members", wsId]` | 工作區成員，快取形狀 `{ members }` | 設定 → 成員、`useWorkspaceMembers()`（只用 `select` 轉換） |
| `["check-code", code]` | 短碼是否可用（staleTime 60s） | Kickstart 確認步驟 |
| `["tags"]` / `["templates"]` / `["workspace-utm-settings"]` / `["utm-campaigns"]` | 共用資源 | 多處 |

**`QueryClient` 預設值**（`lib/query/client.ts`）：
- `staleTime: 5 min`、`gcTime: 30 min`
- `refetchOnWindowFocus / refetchOnMount / refetchOnReconnect: false`（**全關**，避免偷偷重抓）
- `retry: 1`

**Mutation 後要 invalidate 什麼**（在 CreateLinkForm、LinksClient、edit page、goal save 都有處理）：
- 建 / 改 / 刪 link → `campaigns-summary` + `analytics-raw` + `campaign-links` + `utm-campaigns`（刪除另加 `links-trash`）
- 還原 link → 上面四個 + `links`
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

**權限判斷全部集中在 `lib/workspace.ts`，依情境選一個：**

```
① Resource 層級 — canUserActOnResource(userId, { createdById, workspaceId })
     編輯 / 刪除 / clone / share 某一筆資源時用
     - 是建立者 → 永遠 yes
     - 在 resource workspace 是 OWNER/ADMIN → yes（admin override）
     - 其他 → no
     - workspaceId=NULL 的 orphan → 只有建立者能動

② Workspace 層級 — isWorkspaceAdmin(role) + resolveWorkspaceAccess(request, session)
     不綁定單一資源的管理權（治理設定、稽核紀錄）時用。workspace 從
     header 解析、沒有時 fallback，跟 resolveWorkspaceScope 一致
     - resolveWorkspaceAccess 回傳 { workspaceId, role } 或 null
     - isWorkspaceAdmin(role) → role 是 OWNER 或 ADMIN

③ /api/workspaces/* 專用 — requireWorkspaceMember(workspaceId, userId, roles?)
     workspaceId 來自路由參數（不是 header），而且回應需要完整的
     member / workspace row（名稱、slug、角色）
     - 回傳 { member, workspace } 或 { error, status }
     - 呼叫端用 `if ("error" in access)` 判別
     - 非成員回 404 而非 403：不對外確認 workspace 是否存在

低階原語 checkWorkspaceAccess(workspaceId, userId) → { workspaceId, role }
只回角色，供上面幾個和 resolveWorkspaceScope 內部使用。
```

⚠️ 2026-08-31 之前，`/api/workspaces/[id]/`、`invitations/`、`members/`
三個 route **各自有一份完全相同的本地 `checkWorkspaceAccess` 複製**（連
`WorkspaceRole` 型別也複製了兩份），已收斂成上面的 ③。新增 workspace
管理 API 直接 import，不要再複製。

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

`/campaigns/kickstart`：引導式 6 步（類型 → 基本資訊 → 目的網址 → 通路 → 目標 → 確認），等於活動規劃 skill 的網頁版。UTM / 短碼 / 標題 / 標籤由 `lib/kickstart/naming.ts` 依 skill 的 `utm-rules.md` 產生；一次送 `/api/links/batch-csv`（沿用 CSV 匯入的白名單、標籤、自訂短碼處理），再 `PATCH /api/utm-campaigns/[name]` 寫入期間 / 負責人 / 依通路目標。

**擴充模式**：使用者輸入既有 utm_campaign 名稱時，wizard query `/api/links?campaign=<name>` 找出已建頻道，自動 uncheck 對應列（用 `useRef` 確保只 auto-uncheck 一次，不會 stomp 使用者手動切換）。完全成功的列在 submit 後也自動 uncheck，避免 partial-failure retry 重複建立。

範本定義在 `lib/kickstart/templates.ts`（與 skill 的 `references/type-*.md` 同步）；文字走 i18n namespace `kickstart`。元件在 `components/kickstart/KickstartWizard.tsx`。

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

## 15. 社群分享預覽覆寫

`ShortLink.ogOverride{Title,Description,Image}`（全 nullable，只在編輯頁設定）。`/s/[code]` 在「有覆寫值 **且** `isPreviewCrawler(ua)`」時回 200 HTML（自訂 `og:*` + meta refresh，`private, no-store`），**不轉址也不記點擊**。邏輯在 `lib/social-preview.ts`；空欄位 fallback 到爬到的 `og*` → `title`。分支刻意放在 geo 檢查**之前**（FB/LINE 從美國機房抓）。

## 16. 垃圾桶

`/links/trash` + `GET /api/links/trash`（上限 200、不走 Redis）+ `POST /api/links/[id]/restore`（`canUserActOnResource`、寫 `RESTORE_LINK`）。query key `["links-trash"]`，LinksClient 的刪除會 invalidate 它。

## 17. 分享報告期間與內容

`ShareToken.rangeWindow` 存 `all` / `YYYY-MM-DD..YYYY-MM-DD`（台灣時間、含頭尾）/ 舊的 `7d` 等滾動值，解析全在 `lib/share-period.ts`。UI 一律產生固定日期（滾動視窗會讓主管隔週打開數字變了）。報告排除測試與疑似掃描點擊；活動報告的副標顯示負責人**名字**（公開頁，不露 email / 頭像）。

## 18. QR 下載

一律走 `lib/qr-export.ts`（`qrcode` 套件現場產 1024px PNG / 真向量 SVG + 中央 logo），不要從畫面上的小 canvas `toDataURL`。

## 19. 列表建立者

`ShortLink.createdById` **沒有 Prisma relation**，`lib/link-creators.ts` 用一次 `user.findMany` 批次查名字，`/api/links`（Redis key `links-list-v4`）與 `/api/export/links` 共用。要在別處顯示建立者就用它，別每列各查一次。

## 20. 建立連結流程

`/links/new` 是 server page，讀 `?utmCampaign=` / `?template=`（模板依 workspace 成員資格查）後把 `prefill` 傳給 `CreateLinkForm`；建立成功**留在原頁**顯示短網址 + QR，不 redirect 回 `/links`。其他入口（活動頁「新增連結」、模板頁「使用」）都靠這兩個參數。

## 21. 疑似掃描點擊（`Click.isSuspectedBot`）

規則只有一條：UA 是 Chromium 且主版號 < 100（`lib/click-quality.ts`）。企業郵件安全閘道會在 EDM 寄出後幾分鐘內開遍所有連結（2026-11 查：EDM 點擊 57% 來自同一個 `Chrome/79` UA，跨 150+ 個 IP）。

- 跟 `isInternal` 一樣**標記不刪除**、不計入 `clickCount`
- 所有統計用 `countedClickWhere(includeExcluded)` 取「算數的點擊」；raw SQL 寫 `AND is_internal = false AND is_suspected_bot = false`
- 「含測試與疑似機器點擊」開關會兩者一起放回；`/api/analytics/raw` 的 meta 有 `excludedByLink`，活動頁只顯示自己連結被排除的數量
- 歷史資料用 `scripts/flag-suspected-bot-clicks.mjs` 回填（可 `--undo`，idempotent），**改規則時兩邊要同步**
- IP 爆量規則（同 IP 一分鐘內 3+ 條連結）試過，會誤抓連看多篇 LinkedIn 的真人，已放棄

## 22. 活動期間與狀態

`Campaign.startDate/endDate` 存「台灣時間當天 00:00」，含頭尾兩天；所有換算在 `lib/campaign-period.ts`（`dayToStoredDate` / `periodBoundsMs` / `periodTimestampWhere` / `campaignPhase`）。

- **狀態由日期推算**（即將開始 / 進行中 / 已結束），只有「封存」是手動（`status=ARCHIVED`，連結照常運作）；舊的 DRAFT / COMPLETED 視同 ACTIVE
- 活動列表、活動頁、比較頁的預設期間都是「活動期間」（沒設就是全部期間）。列表的 `period` 模式抓 730 天 payload、讀每列的 `periodClicks`
- `campaigns-summary` 對有期間的活動各跑一次 `click.count`（活動數很少），沒期間的用全期間 groupBy
- 編輯走 `PATCH /api/utm-campaigns/[name]`（goalClicks / goalByMedium / startDate / endDate / status / ownerId / displayName 皆選填，找不到 Campaign row 會建立）；`/api/campaigns/[id]` 的 PATCH 沒有 UI 在用
- ⚠️ 這個 PATCH 的回應與 `["campaign-goal", name]` 快取共用同一份紀錄，前端更新時要 **merge**，不要用只有 goal 的物件覆寫（曾讓期間列暫時消失）

## 23. 活動頁下鑽

- 流量分頁的每個清單（source / medium / content / 連結 / 國家 / 來源網站）都是篩選器，走 `computeAnalytics` 的 `source/medium/content`（連結層）與 `country/referrer`（點擊層）
- `linkId` 也必須符合 campaign / tag 範圍（`linkPasses`），避免拿別的活動的 id 看到別人的數字；`/analytics` 選連結時會自動拿掉不符的篩選
- 來源網站依網站合併在 `lib/analytics/referrer.ts`（品牌族群表、`android-app://` 套件名、IP 原樣、共用網域如 `github.io` 保留子網域），`NO_REFERRER` 代表無 referrer
- 連結分頁點一列就地展開 `components/campaigns/CampaignLinkDetail.tsx`；表格用 `table-layout: fixed`（除連結欄外都有固定寬度，**寬度含 padding**）
- 從活動頁編輯連結帶 `?returnTo=/campaigns/<name>`（編輯頁只接受 `^/campaigns/[^/?#]+$`，存檔後回到連結**目前**所屬的活動）
- 比較頁「對齊開始日」以日期差算第 0 天（開始日前為負天數，最多 60 天；95% 點擊後再 7 天截尾，最長 120 天）。時間軸是 UTC 日、開始日是台灣日，差 8 小時屬已知近似；折線 / 圖例 / 欄位共用 `CAMPAIGN_PALETTE`

## 24. 依通路的點擊目標

- `Campaign.goalByMedium`（Json，`{ "<utm_medium>": clicks }`，可為空）；有設時 API 讓 `goalClicks` = 加總，所以活動列表 / 比較頁照舊只讀 `goalClicks`
- 只存總數或清除目標時 API 把 `goalByMedium` 設回 `Prisma.DbNull`，避免拆分跟總數對不上
- 進度參考線（`lib/campaign-goal.ts` 的 `goalPaceFraction`）= 活動期間已經過的比例 × 目標，只在「進行中且有開始與結束日」時顯示；第一版是線性
- 目標卡在 `components/campaigns/CampaignGoalCard.tsx`。分母一律是活動期間點擊、不封頂

## 25. 活動負責人

- `Campaign.ownerId`（FK → users，`onDelete: SetNull`，有 `@@index`）是**明確指派**的 KPI 負責人，不要拿 `createdById` 代替（活動多半是第一條連結自動建出來的）
- 指派走 `PATCH /api/utm-campaigns/[name]` 的 `ownerId`，API 會檢查對方是該 workspace 成員，並寫進稽核紀錄
- 成員清單用 `components/campaigns/CampaignOwner.tsx` 的 `useWorkspaceMembers()`——它跟 設定 → 成員 **共用 query key `["workspace-members", wsId]` 與快取形狀 `{ members }`**，只用 `select` 轉換，不要改成存陣列
- 活動列表的負責人摘要卡**刻意不加總點擊**（不同活動量級差百倍），只算進行中 / 達標 / 落後進度幾檔
