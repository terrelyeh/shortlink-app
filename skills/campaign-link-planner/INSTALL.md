# campaign-link-planner 安裝與使用說明

這個 skill 會用問答方式幫你規劃一個行銷活動（新品上市、展會、電商促銷）的追蹤連結，最後產出：

1. `<活動名稱>_links.csv`：上傳到 EnGenius ShortLink 的「CSV 匯入」就能一次建好所有連結
2. `<活動名稱>_plan.md`：一頁成效衡量計畫（目標、什麼時候看什麼、判斷規則、結案怎麼交）

> 這份 INSTALL.md 是給人看的，agent 不需要讀它。

## 安裝

整個 `campaign-link-planner` 資料夾要保持原樣（`SKILL.md` + `references/` + `scripts/`），不要只拿 `SKILL.md`。

| 平台 | 放法 |
|---|---|
| **Claude Code** | 把資料夾放到 `~/.claude/skills/campaign-link-planner/`（個人）或專案的 `.claude/skills/campaign-link-planner/`（團隊共用） |
| **Claude.ai** | 設定 → Capabilities（功能）→ Skills → 上傳這個 zip。需要先開啟程式碼執行功能；組織版可能要管理員先允許自訂 skill |
| **Codex** | 新版 Codex 支援 skills：放到 `~/.codex/skills/campaign-link-planner/`。舊版不支援的話，跟它說「讀 `<路徑>/SKILL.md` 並照著做」也可以 |
| **Hermes Agent** | 放進 Hermes 的 skills 目錄（同樣是 `SKILL.md` 格式）。不確定目錄的話，一樣可以直接叫它讀 `SKILL.md` |
| **其他 AI 工具** | 把 `SKILL.md` 和需要的 `references/*.md` 內容貼給它，說「照這份指示幫我規劃活動連結」 |

各平台的 skill 設定位置會隨版本更新，以平台當下的說明為準。

## 使用

直接用自然語言開口就會觸發，例如：

- 「幫我規劃 Computex 2027 的展會連結」
- 「黑五要幫美國、德國、英國 Amazon 站準備追蹤連結」
- 「下個月新品上市，要發 LinkedIn 跟 EDM，幫我建一整套 UTM」

一開始資訊不完整沒關係，它會分 2～3 輪問你（每題都有預設值，可以直接回「照預設」）。手邊有活動企劃的話直接貼上，它只會問缺的部分。產出前會先給你一張連結清單確認。

## 匯入

連結管理 → 「建立新連結」旁的 ▾ → **CSV 匯入** → 上傳 CSV → 看預覽 → 匯入。

- 某一列失敗（例如自訂短碼已被用掉）只會跳過那一列，其他照常建立
- 匯入後到活動頁設定活動期間和各通路目標（計畫第 2 節），每條連結按「測試短網址」測一次（有設生效時間的，生效後再測）

## 檢查 CSV（選用）

能跑 Python 的環境，skill 會自己用 `scripts/validate_links_csv.py` 檢查格式。你也可以手動跑：

```
python3 scripts/validate_links_csv.py 你的檔案.csv
```

## 它做不到的事

- 看不到工具裡已經有哪些活動、連結或短碼（所以會問你是新活動還是延續舊的）
- 這個工具只算「點擊」；詢價、名單、訂單要看 GA4、CRM 或 Amazon 後台
