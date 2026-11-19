# 成效衡量計畫 template

Fill every section; keep it to roughly one printed page. Write in the user's language (default 繁體中文). Use real numbers from the conversation; anything you estimated gets 「（待校正）」 so nobody mistakes a guess for a commitment. Section 3 and 4 come from the campaign-type reference file — adapt them to this campaign's channels and goal, don't paste them generically.

```markdown
# 成效衡量計畫：<活動名稱>

**活動名稱（utm_campaign）**：`<campaign>` · **期間**：<start> ～ <end> · **負責人**：<owner or 待填>

## 1. 活動摘要
| 市場 | 目的網址 | 通路 |
|---|---|---|
| <market> | <url> | <channels with counts> |

共 **<N> 條追蹤連結**，見 `<campaign>_links.csv`（連結管理 → 建立新連結 ▾ → CSV 匯入）。
<one line on how markets / creatives are told apart: tags + utm_content suffix>

## 2. 目標
| 指標 | 目標 | 怎麼訂的 |
|---|---|---|
| 總點擊（活動期間） | <n>（= 下面各通路加總） | <basis, or （待校正）> |
| <utm_medium, e.g. email> | <n> | <basis> |
| <utm_medium, e.g. social> | <n> | <basis> |
| <utm_medium, e.g. qr> | <n> | <basis> |
| <downstream: 詢價表單 / 名單 / 訂單> | <n> | <where it's measured: GA4 / CRM / Amazon> |

Give one row per `utm_medium` the CSV actually uses (the tool's goal editor is per medium, so use the exact medium values). Then:

上線後在活動頁：① 設定活動期間 <start> ～ <end>，並指定負責人（活動名稱下方「負責人」）；② 目標卡 → 鉛筆 →「依通路」，填 <medium> <n>、<medium> <n>…（總目標自動加總）。每個通路會有自己的進度條，並標出「照時間應該到哪裡」。

## 3. 每個階段看什麼、在哪看
| 時間 | 要回答的問題 | 去哪看 |
|---|---|---|
| <before go-live> | 連結都能開嗎？預覽卡片對嗎？ | 每條按「測試短網址」（有設生效時間的，生效後再測）；社群連結用預覽除錯工具 |
| <early days> | <…> | 活動頁「流量」「連結」分頁 |
| <mid> | <…> | 分析頁 7×24 熱度圖 / 點擊衰減曲線 / 城市排行 |
| <weekly / daily> | 進度跟得上目標嗎？哪個通路落後？ | 活動頁目標卡：各通路進度條上的參考線（超前 / 落後） |
| 結案 | 整體成效、下次怎麼調 | 見第 5 節 |

## 4. 判斷規則
- <condition with a number> → <action>
- <…>
（3–5 rules, specific to this campaign）

## 5. 結案交付
1. **給主管**：活動頁 →「分享報告」→ 活動期間（報告日期固定，之後打開數字不變；報告會顯示負責人）
2. **自己分析**：分析頁篩選本活動 → 匯出 CSV → 樞紐分析「<market or position> × 通路」
3. **跟上一檔比**：活動列表勾選兩個活動 →「比較」
4. **對照 <GA4 / Amazon / CRM>**：用 `utm_campaign = <campaign>` 篩選 <what>

## 6. 注意事項
- <only what applies — pick from SKILL.md「Measurement traps」: EDM 掃描灌水、展場共用 Wi-Fi、QR 印刷尺寸、表單/預約工具保留 UTM、IG 內文不能放連結、Amazon 14 天歸因窗、與去年比要同基準；plus: 這個工具只算點擊、CTR 需要平台曝光數、印刷 QR 不設到期>
```
