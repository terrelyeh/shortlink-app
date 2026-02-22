# Shortlink App 完整審查報告

> 分析日期：2026-02-17 | 分支：`claude/repo-review-B300a`

---

## 一、功能完成度總覽表

| # | 功能模組 | 完成度 | 說明 |
|---|---------|--------|------|
| 1 | 短連結建立（單筆） | ✅ 95% | 自訂/自動 code、UTM、標籤、Campaign、過期、點擊上限 |
| 2 | 短連結建立（批次） | ⚠️ 80% | 可批次建立，但缺 transaction、失敗無個別錯誤回報 |
| 3 | 短連結管理 | ✅ 90% | CRUD、軟刪除、狀態切換、Clone、Preview |
| 4 | 批次操作 | ✅ 90% | 刪除/暫停/啟用/封存，上限 100 筆 |
| 5 | 標籤系統 | ⚠️ 75% | 建立/篩選可用，但未 workspace 隔離，無顏色自訂 UI |
| 6 | Campaign 管理 | ✅ 85% | CRUD、與連結關聯、統計，但缺 workspace 範圍限制 |
| 7 | UTM 範本 | ⚠️ 70% | CRUD 可用，仍用已棄用的 userId，未 workspace 化 |
| 8 | Analytics 儀表板 | ⚠️ 75% | 點擊趨勢、裝置/瀏覽器/OS、Referrer、UTM 分析齊全；缺 GeoIP、無快取 |
| 9 | CSV 匯出 | ✅ 90% | 連結 + Analytics 匯出正常 |
| 10 | QR Code | ✅ 85% | PNG/SVG 匯出、品牌化（Logo 插槽、Error Correction H） |
| 11 | 短連結重導 | ✅ 90% | Bot 偵測、點擊去重（10s）、Rate Limit 100/min |
| 12 | 驗證/登入 | ⚠️ 70% | Google OAuth only，NextAuth 5 beta，缺其他 provider |
| 13 | 角色權限 | ✅ 85% | ADMIN/MANAGER/MEMBER/VIEWER，API 層有檢查 |
| 14 | Workspace | ⚠️ 60% | Model 完整、CRUD 可用，但多數 API 未按 workspace 過濾 |
| 15 | Workspace 邀請 | ❌ 40% | DB + API 完成，**但 Email 未實作**（功能不可用） |
| 16 | 分享報告 | ⚠️ 75% | Token + 密碼 + 觀看次數限制，但密碼驗證無 Rate Limit |
| 17 | 稽核日誌 | ✅ 90% | 所有 CRUD 操作都有記錄，分頁/篩選可用 |
| 18 | i18n 國際化 | ✅ 90% | en + zh-TW 300+ keys，少數元件有 hardcoded 字串 |
| 19 | RWD 響應式 | ✅ 85% | Mobile sidebar、responsive grid，tablet 可再優化 |
| 20 | 使用者管理 | ✅ 85% | 列表/角色變更/刪除（ADMIN only） |
| 21 | 測試 | ❌ 0% | 無任何測試檔案 |
| 22 | 部署 | ⚠️ 60% | Zeabur 可用，但 start script 用 `db push`（應改 migrate deploy） |

---

## 二、功能建議（18 項）

### 高優先（P0）— 影響核心流程

| # | 建議 | 原因 | 影響範圍 |
|---|------|------|---------|
| F1 | **實作 Email 發送（邀請信）** | Workspace 邀請功能完全不可用 | 邀請流程 |
| F2 | **新增更多 OAuth Provider** | 僅 Google 登入，限制使用者群 | 登入頁 |
| F3 | **Workspace 範圍過濾** | 連結/標籤/Campaign/範本未按 workspace 過濾 | 全站 API |
| F4 | **GeoIP 地理位置追蹤** | Analytics 缺國家/城市資料 | Analytics |

### 中優先（P1）— 提升使用體驗

| # | 建議 | 原因 | 影響範圍 |
|---|------|------|---------|
| F5 | **Loading skeleton** | 多頁面載入時無骨架屏，體驗差 | Dashboard/Analytics/Links |
| F6 ✅ | ~~**Toast 通知系統**~~ | ~~操作成功/失敗無統一回饋~~ **已實作**：全站統一 toast 元件 | 全站 |
| F7 ✅ | ~~**確認對話框一致化**~~ | ~~部分刪除操作無確認、角色變更無確認~~ **已實作**：ConfirmDialog 元件，覆蓋刪除/角色變更 | Links/Users/Templates |
| F8 ✅ | ~~**搜尋 Debounce**~~ | ~~Links 頁搜尋每次按鍵都觸發 API~~ **已實作**：slug 可用性檢查 + 搜尋欄 debounce | Links 頁 |
| F9 | **自訂網域支援** | 專業用途必備 | 重導/設定 |
| F10 | **進階 Analytics（漏斗/A-B Test）** | 行銷團隊常見需求 | Analytics |
| F11 | **批次匯入（CSV）** | 大量建立連結的反向功能 | Links |
| F12 | **密碼變更/帳號管理** | Settings 頁幾乎是唯讀的 | Settings |

### 低優先（P2）— 錦上添花

| # | 建議 | 原因 | 影響範圍 |
|---|------|------|---------|
| F13 | **Dark Mode** | i18n 有 key 但未實作 | 全站 |
| F14 | **Webhook 事件通知** | 允許外部系統整合 | API |
| F15 | **API Documentation（OpenAPI/Swagger）** | 第三方整合需要 | 文件 |
| F16 | **瀏覽器擴充功能** | 快速建立短連結 | 新產品 |
| F17 | **稽核日誌匯出** | 合規需求 | Audit Log |
| F18 | **鍵盤導航/無障礙優化** | Dropdown/Modal 缺 focus 管理 | 全站元件 |

---

## 二-B、已額外實作的新功能（Phase 3）

以下為審查後額外規劃並實作的功能，超出原始 18 項建議範圍：

| # | 功能 | 說明 | 影響範圍 |
|---|------|------|---------|
| N1 ✅ | **Campaign KPI 目標追蹤** | 在 Campaign 詳情頁設定目標點擊數，顯示即時進度條（%、剩餘點擊、達標 🎉）；Schema 新增 `goalClicks Int?` | Campaigns 頁、`/api/utm-campaigns/[name]` |
| N2 ✅ | **Analytics 標籤篩選器** | Analytics 頁新增 Tag 下拉篩選，與 Campaign/Link 串聯為三層過濾；Analytics API 支援 `tagId` 參數 | Analytics 頁、`/api/analytics` |
| N3 ✅ | **UTM 命名規範治理** | Settings → UTM Rules 分頁（Admin/Manager 限定）：以標籤 UI 管理核准的 Source/Medium 清單；建立連結時若輸入未核准值顯示警告 badge；Schema 新增 `utmSettings Json?` | Settings 頁、CreateLinkForm、`/api/workspace/utm-settings` |

---

## 三、技術建議（8 項）

### T1. 🔒 Share Token 密碼暴力破解防護（P0 安全）

**問題**：`/api/share/[token]` 的密碼驗證端點無 Rate Limit，可暴力破解。且密碼錯誤時也遞增 viewCount，導致觀看限制可被繞過。

**建議**：
- 加入 Rate Limit（5 次/分鐘）
- 密碼驗證成功才遞增 viewCount

---

### T2. 🔒 IP_HASH_SALT 強制檢查（P0 安全）

**問題**：環境變數 `IP_HASH_SALT` 缺失時僅 console.warn，不會中斷。

**建議**：Production 環境缺少時應直接 throw error，阻止啟動。

---

### T3. ⚡ 以 Redis 取代 In-Memory Rate Limiter（P1 效能/安全）

**問題**：目前 rate limiter 存在記憶體中，多實例部署時每台各自計算，等於無效。

**建議**：改用 Redis sliding window，所有實例共享計數。

---

### T4. ⚡ 新增缺失的資料庫索引（P1 效能）

**建議新增**：
```sql
CREATE INDEX idx_short_links_deleted_at ON short_links(deleted_at);
CREATE INDEX idx_short_links_workspace_status ON short_links(workspace_id, status);
CREATE INDEX idx_clicks_ip_hash ON clicks(ip_hash);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_tags_name ON tags(name);
```

---

### T5. 🏗️ 改用 Prisma Migrate 取代 db push（P0 部署）

**問題**：`start` script 用 `prisma db push` 自動同步 schema，無版本控制，production 有資料遺失風險。

**建議**：
- 改用 `prisma migrate deploy`
- 將 migration 檔案納入 git 版本控制

---

### T6. 🧹 完成 Workspace 遷移，移除 legacy userId（P1 技術債）

**問題**：`ShortLink` 和 `UTMTemplate` 仍保留已棄用的 `userId` 欄位，部分 API（如 batch create、templates）仍使用。

**建議**：統一改用 `createdById` + workspace 關聯，移除 legacy 欄位。

---

### T7. 🧪 建立測試套件（P1 品質）

**問題**：整個專案 0 個測試檔案。

**建議架構**：
```
tests/
  unit/        → auth, rate-limit, shortcode 生成
  integration/ → links CRUD, workspace 權限, 邀請流程
  e2e/         → 完整使用者流程
```
目標覆蓋率 >80%。

---

### T8. 📊 Error Tracking + Structured Logging（P2 可觀測性）

**問題**：僅用 `console.error`，無結構化日誌，無錯誤追蹤。

**建議**：
- 加入 Sentry 進行 error tracking
- 加入 pino 進行 structured logging
- 硬編碼的 magic number 抽為 `constants.ts` 設定檔

---

## 四、優先順序總覽

```
┌─────────────────────────────────────────────────────┐
│  P0（立即修復）                                       │
│  T1 Share 密碼防護  │  T2 Salt 強制  │  T5 Migrate  │
│  F1 Email 發送      │  F3 Workspace 過濾             │
├─────────────────────────────────────────────────────┤
│  P1（本月完成）                                       │
│  T3 Redis Rate Limit │ T4 DB Index │ T6 遷移清理     │
│  T7 測試套件  │ F2 OAuth │ F4 GeoIP │ F5 Loading    │
│  F6 Toast     │ F7 確認對話框  │  F8 Debounce       │
├─────────────────────────────────────────────────────┤
│  P2（之後規劃）                                       │
│  T8 Logging/Sentry │ F9~F18 進階功能                 │
└─────────────────────────────────────────────────────┘
```

---

## 五、評分摘要

| 維度 | 分數 | 說明 |
|------|------|------|
| 功能完成度 | **7.5/10** | 核心功能齊全，Workspace/邀請/GeoIP 未完成 |
| 程式碼品質 | **7/10** | TypeScript + Zod 驗證佳，但有 type assertion hack、重複程式碼 |
| 安全性 | **6.5/10** | Auth + Audit 佳，Rate Limit 不足、密碼端點裸露 |
| 效能 | **6/10** | 無快取、In-memory rate limiter、Analytics 查詢低效 |
| 測試 | **0/10** | 無任何測試 |
| 部署就緒 | **5/10** | db push 風險、無 error tracking、無 monitoring |
| UI/UX | **8/10** | 設計美觀、RWD 良好，缺 loading state 和 toast |
| **總體** | **7/10** | 良好基礎，需加強安全、測試、效能才能 production ready |
