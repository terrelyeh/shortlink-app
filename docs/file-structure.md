# 檔案結構 — Short Link Manager

> 從 CLAUDE.md 拆出。摘要與關鍵入口見 [CLAUDE.md](../CLAUDE.md)。

```
src/
├── app/
│   ├── layout.tsx                  # ⭐ Root layout：<html>/<body> + fonts
│   │                               #    （非 locale 頁如 /link-*、/share 也要用）
│   ├── [locale]/
│   │   ├── layout.tsx              # Locale 專用：NextIntlClientProvider（無 html/body）
│   │   ├── (dashboard)/            # Route group（不是 /dashboard 路徑）
│   │   │   ├── campaigns/
│   │   │   │   ├── page.tsx        # 登入首頁、Leaderboard
│   │   │   │   ├── CampaignsClient.tsx
│   │   │   │   ├── [name]/page.tsx # 單活動駕駛艙（Overview / Traffic / Links tabs）
│   │   │   │   ├── compare/        # /campaigns/compare?names=a,b,c
│   │   │   │   └── kickstart/      # Wizard：選 playbook 一鍵建整套追蹤連結
│   │   │   ├── links/
│   │   │   │   ├── page.tsx + LinksClient.tsx
│   │   │   │   ├── [id]/           # 編輯
│   │   │   │   ├── new/ batch/ import/ # import 是 CSV 匯入
│   │   │   │   └── ...
│   │   │   ├── analytics/          # 純全站維度分析（砍了 campaign leaderboard）
│   │   │   ├── settings/           # 含 UTM Governance tab
│   │   │   ├── audit-log/          # （/users 已砍，僅留 audit-log）
│   │   │   └── notes/test-clicks/  # 站內說明頁：測試點擊怎麼標記 / 重設
│   │   ├── invite/[token]/
│   │   │   ├── page.tsx            # 受邀者落地頁（讀邀請、accept、auto-redirect）
│   │   │   └── layout.tsx          # 必須：包 SessionProvider（locale layout 沒包）
│   │   └── page.tsx                # 根頁 → 登入時 redirect 到 /campaigns
│   ├── auth/signin/                # NextAuth pages
│   ├── api/
│   │   ├── analytics/
│   │   │   ├── route.ts            # 已聚合（留給 export/share）
│   │   │   ├── raw/route.ts        # raw clicks，給 client-side compute
│   │   │   └── campaigns-summary/  # Leaderboard + per-campaign 時序資料
│   │   ├── track/route.ts          # 🎯 公開 conversion tracking endpoint（CORS *）
│   │   ├── links/
│   │   │   ├── route.ts + [id]/    # CRUD
│   │   │   ├── batch/ batch-csv/   # 批次建立（CSV 是每 row 獨立 UTM）
│   │   │   └── batch-actions/ clone/...
│   │   ├── export/
│   │   │   ├── links/ analytics/   # 共用 csvResponse() helper
│   │   │   └── campaigns/          # 跨活動比較 / 每日長表 / 單活動連結明細
│   │   ├── utm-campaigns/[name]/
│   │   │   └── reset-clicks/       # 軟重設：標 isInternal 而非刪除
│   │   └── {campaigns, tags, templates, workspace, audit-log, ...}
│   ├── s/[code]/route.ts           # 短網址轉址 + variant pick + session 附 ?_sl=
│   ├── share/[token]/              # 公開分享報告（sharetoken 驗證）
│   ├── track.js/route.ts           # 🎯 公開 JS snippet（landing 端引用）
│   ├── link-expired/ link-inactive/ link-limit-reached/
│   │   link-not-yet-active/ link-geo-blocked/  # 狀態頁
│   └── ...
├── components/
│   ├── analytics/
│   │   ├── ClicksChart.tsx PieChartComponent.tsx
│   │   ├── MultiCampaignChart.tsx  # overlay 折線（P0 + Compare 頁共用）
│   │   └── TrendCell.tsx           # 迷你 sparkline + ↑↓% 狀態，Campaign Detail / Leaderboard 共用
│   ├── layout/
│   │   ├── Sidebar.tsx PageHeader.tsx
│   │   └── SyncButton.tsx          # 每頁 header 右上角的「同步 + 最後同步時間」
│   ├── forms/UTMBuilder.tsx        # 含 CampaignCombobox（自訂 Linear/Slack-style，可 inline 建活動）
│   ├── links/
│   │   ├── LinkTableRow.tsx        # 桌面表格列（含 OG 縮圖 + schedule/geo badges）
│   │   └── LinkMobileCard.tsx      # ≤768px 用的 card 版本（useMediaQuery 切換）
│   ├── providers/Providers.tsx     # SessionProvider + QueryClientProvider + WorkspaceProvider + Toast
│   │                               # （注意：dashboard 之外的頁要自己包 SessionProvider）
│   └── ...
├── lib/
│   ├── analytics/compute.ts        # ⭐ Client-side 聚合（純 JS）
│   ├── cache.ts / cache-scopes.ts  # Redis wrapper + bumpLinksCache 等 helper
│   ├── query/client.ts             # React Query QueryClient 設定
│   ├── ratelimit.ts                # Upstash ratelimit（redirect + /api/track）
│   ├── auth.ts                     # NextAuth + DB-driven invitation gate + auto-accept hook
│   ├── workspace.ts                # ⭐ 權限與範圍：resolveWorkspaceScope /
│   │                               #    resolveWorkspaceAccess / isWorkspaceAdmin /
│   │                               #    canUserActOnResource（buildWorkspaceWhere 已刪）
│   ├── fetch-workspace.ts          # ⭐ patch window.fetch 自動塞 x-workspace-id header
│   ├── hooks/useMediaQuery.ts      # SSR-safe matchMedia hook（mobile 切換用）
│   ├── og-scraper.ts utm-governance.ts variants.ts campaign-autolink.ts
│   ├── campaign-playbooks.ts       # Kickstart wizard 的 playbook 定義（Product Launch / Exhibition）
│   └── utils/{utm,shortcode,format}.ts
├── messages/{en,zh-TW}.json        # 雙語文件；每新增使用者可見字串就兩邊都要加
└── middleware.ts                   # next-intl routing + 短域名守護（rewrite /<code> → /s/<code>）
prisma/schema.prisma                # 含 @@index — FK 索引不自動建
scripts/                            # 全部預設 dry-run，加 --apply 才寫入
├── backfill-campaign-autolink.mjs  # 一次性 orphan link → Campaign 綁定
├── backfill-workspace-id.mjs       # 補回 workspaceId=null 的 ShortLink/Campaign/UTMTemplate/Click
└── merge-duplicate-campaigns.mjs   # 合併重複 Campaign 列（同名自動 / 別名列在 ALIASES）
```
