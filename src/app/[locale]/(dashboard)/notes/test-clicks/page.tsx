/**
 * In-app help note explaining the test-click filter feature.
 *
 * Linked from the dashboard footer. Server-rendered, no live data —
 * pure documentation. Written long-form in Chinese with English code /
 * UI labels because the team is bilingual and this is internal docs
 * (no value in running every paragraph through next-intl).
 */

import Link from "next/link";
import {
  ArrowLeft,
  FlaskConical,
  RotateCcw,
  ToggleLeft,
  Info,
  Copy,
  MoreVertical,
  Check,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

export default function TestClicksNote() {
  return (
    <article className="note-article">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors group mb-6 text-sm"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>返回</span>
      </Link>

      <header className="mb-8">
        <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">
          Internal Note
        </div>
        <h1 className="text-3xl font-semibold text-slate-900 mb-2">
          測試點擊（Test Clicks）使用指南
        </h1>
        <p className="text-slate-500">
          建好連結後 QA / 內部測試的點擊不要污染正式分析數據。本頁說明這個功能怎麼用、怎麼運作、什麼時候用。
        </p>
      </header>

      <section className="note-section">
        <h2>為什麼需要這個功能</h2>
        <p>
          行銷團隊建好短網址後，通常會：
        </p>
        <ul>
          <li>內部 QA 點開驗證會跳到對的 landing page</li>
          <li>分享給主管 / 業務 / 法務 review</li>
          <li>放進 EDM 模板測試版面</li>
          <li>EDM / 廣告投放前先放在 Slack 預覽</li>
        </ul>
        <p>
          這些點擊如果跟正式流量混在一起，分析數據就被汙染：CVR 算錯、來源歸因不準、leaderboard 排序失真。
          <strong>「測試點擊」</strong>就是把這類流量跟真實用戶分開的機制。
        </p>
      </section>

      <section className="note-section">
        <h2>兩種偵測方式</h2>

        <h3>1. 顯式：URL 帶 <code>?_test=1</code></h3>
        <p>
          任何短網址後面加上 <code>?_test=1</code> 開啟，這次點擊就會被標為測試。例如：
        </p>
        <pre>https://go.engenius.ai/cx26-Lin-Promo-1?_test=1</pre>
        <p>
          系統會在轉址前把 <code>_test=1</code> 從目的 URL 拿掉，不會汙染落地頁的 GA referrer。
        </p>

        <h3>2. 自動：登入的工作區成員</h3>
        <p>
          你在 dashboard 登入後，<strong>同一個瀏覽器</strong>點短網址（不論有沒有帶 <code>?_test=1</code>），
          系統會偵測到你是這個 workspace 的 member，自動標為測試。
        </p>
        <p className="note-callout">
          <Info className="w-4 h-4 inline mr-1.5 text-slate-400" />
          覆蓋日常隨手測試的情境。但這個只在<strong>同一個瀏覽器有 NextAuth cookie</strong> 時生效 —
          隱私視窗 / 別的裝置 / 手機都不會自動偵測，這時要主動加 <code>?_test=1</code>。
        </p>
      </section>

      <section className="note-section">
        <h2>怎麼測試一條連結</h2>
        <p>app 內提供三個入口，自動加 <code>?_test=1</code>，不用記語法：</p>

        <h3 className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-violet-500" />
          /links 列表 — 直接點短網址
        </h3>
        <p>
          列表裡藍色的 <code>/cx26-Lin-Promo-1</code> 文字就是 anchor，點下去 = 開新分頁測試。
          旁邊的複製按鈕<strong>不會</strong>帶 <code>?_test=1</code>，所以複製出去給客戶的還是乾淨網址。
        </p>
        {/* Mockup: how the short URL cell looks on /links */}
        <div className="mock-frame">
          <div className="mock-label">範例</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 0" }}>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "#03A9F4",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              /cx26-Lin-Promo-1
            </a>
            <button
              type="button"
              style={{
                padding: 4,
                borderRadius: 4,
                background: "transparent",
                border: 0,
                color: "var(--ink-400)",
                cursor: "pointer",
              }}
              aria-label="copy"
            >
              <Copy size={12} />
            </button>
            <span style={{ marginLeft: 12, fontSize: 12, color: "var(--ink-500)" }}>
              ← 點藍字 = 測試（帶 ?_test=1）　・　點 <Copy size={11} style={{ display: "inline", verticalAlign: "-2px" }} /> = 複製乾淨網址
            </span>
          </div>
        </div>

        <h3 className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-violet-500" />
          /links 列表 — 列尾選單
        </h3>
        <p>
          每一列右邊的 <code>⋯</code> 選單裡有「測試短網址」項，點了開新分頁。手機 card view 的選單也有同樣項目。
        </p>
        {/* Mockup: row menu open */}
        <div className="mock-frame">
          <div className="mock-label">範例</div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <button
              type="button"
              style={{
                padding: 6,
                borderRadius: 4,
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                color: "var(--ink-400)",
                cursor: "pointer",
              }}
              aria-label="more"
            >
              <MoreVertical size={14} />
            </button>
            <div
              style={{
                width: 200,
                background: "white",
                borderRadius: 8,
                border: "1px solid var(--border)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                padding: "4px 0",
                fontSize: 13,
              }}
            >
              <div className="mock-menu-item">編輯</div>
              <div className="mock-menu-item">數據分析</div>
              <div className="mock-menu-item mock-menu-highlight">
                <FlaskConical size={13} style={{ color: "var(--brand-700)" }} />
                測試短網址
              </div>
              <div className="mock-menu-item">QR Code</div>
              <div className="mock-menu-item">建立副本</div>
              <div className="mock-menu-item">暫停</div>
            </div>
          </div>
        </div>

        <h3 className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-violet-500" />
          編輯連結頁面
        </h3>
        <p>
          頁面頂端 read-only 短網址欄位旁邊有紫色「測試短網址」按鈕。剛改完設定想立刻驗證時最順手。
        </p>
        {/* Mockup: edit page header strip */}
        <div className="mock-frame">
          <div className="mock-label">範例</div>
          <div style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 13,
              }}
            >
              <span style={{ fontSize: 11, color: "var(--ink-500)", fontWeight: 600, letterSpacing: "0.04em" }}>
                短網址代碼
              </span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-200)" }}>
                go.engenius.ai/cx26-Lin-Promo-1
              </span>
            </div>
            <button
              type="button"
              style={{
                padding: "0 14px",
                background: "white",
                border: "1px solid var(--border)",
                borderRadius: 10,
                color: "var(--ink-400)",
                fontSize: 13,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Copy size={13} /> 複製
            </button>
            <button
              type="button"
              style={{
                padding: "0 14px",
                background: "white",
                border: "1px solid var(--border)",
                borderRadius: 10,
                color: "var(--ink-400)",
                cursor: "pointer",
              }}
              aria-label="open"
            >
              <ExternalLink size={13} />
            </button>
            <button
              type="button"
              style={{
                padding: "0 14px",
                background: "#F3E8FF",
                border: "1px solid #D8B4FE",
                borderRadius: 10,
                color: "#7E22CE",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FlaskConical size={13} /> 測試短網址
            </button>
          </div>
        </div>
      </section>

      <section className="note-section">
        <h2>數據怎麼呈現</h2>

        <h3>預設視圖：實際流量</h3>
        <p>
          所有頁面（/links、/campaigns、/analytics）<strong>預設過濾</strong>測試點擊。你看到的數字都是真實用戶。
        </p>

        <h3 className="flex items-center gap-2">
          <ToggleLeft className="w-4 h-4 text-slate-500" />
          想看含測試的版本：toggle
        </h3>
        <p>
          /analytics 跟 /campaigns/[name] 頂部有「<strong>含測試點擊</strong>」toggle，打開即可看到完整數字。
          常見用途：跟內部其他 dashboard 對數字（外部數字含 click event 沒過濾的話），或審查 QA 流量分布。
        </p>
        {/* Mockup: toggle states side-by-side */}
        <div className="mock-frame">
          <div className="mock-label">兩種狀態</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span className="mock-toggle">
              <span className="mock-checkbox" />
              含測試點擊
            </span>
            <span className="mock-toggle mock-toggle-on">
              <span className="mock-checkbox mock-checkbox-on">✓</span>
              含測試點擊
            </span>
          </div>
        </div>

        <h3>列表「點擊數」永遠是 real-only</h3>
        <p>
          /links 列表那欄點擊數<strong>不受 toggle 影響</strong>，永遠只算實際流量。原因：列表是日常 inventory 視圖，
          不應該因為 analytics 那邊的設定而變來變去。Hover 點擊數欄位的 <code>ⓘ</code> icon 有完整說明。
        </p>

        <h3>過濾指示</h3>
        <p>
          當期間內有測試點擊被過濾時，/analytics 跟 /campaigns/[name] 會顯示一行提示。想看可以點旁邊「全部顯示」一鍵打開 toggle。
        </p>
        {/* Mockup: filter banner */}
        <div className="mock-frame">
          <div className="mock-label">範例</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 14px",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12.5,
              color: "var(--ink-400)",
            }}
          >
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              已過濾 <strong style={{ color: "var(--ink-200)" }}>2</strong> 筆測試點擊（來自「測試短網址」或工作區成員）
            </span>
            <button
              type="button"
              style={{
                height: 26,
                fontSize: 12,
                padding: "0 10px",
                borderRadius: 6,
                background: "transparent",
                border: 0,
                color: "var(--ink-400)",
                cursor: "pointer",
              }}
            >
              全部顯示
            </button>
          </div>
        </div>
      </section>

      <section className="note-section">
        <h2 className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-amber-600" />
          重設 Campaign 的點擊計數（Soft Reset）
        </h2>
        <p>
          測試了一段時間後想「正式從 0 開始算」？/campaigns/[name] PageHeader 有圈箭頭 icon，點了開啟確認 dialog。
        </p>
        {/* Mockup: reset confirmation dialog */}
        <div className="mock-frame mock-frame-dialog">
          <div className="mock-label">確認對話框長這樣</div>
          <div
            style={{
              background: "white",
              borderRadius: 16,
              border: "1px solid var(--border)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              padding: 20,
              maxWidth: 420,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#FEF3C7",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <RotateCcw size={16} style={{ color: "#D97706" }} />
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-100)", margin: "0 0 4px" }}>
              重設「computex-26」的點擊計數？
            </h4>
            <p style={{ fontSize: 13, color: "var(--ink-500)", margin: "0 0 14px" }}>
              此動作會把這個活動旗下 8 條連結共 66 筆實際點擊標記為測試數據，KPI / 圖表會立刻歸 0。
            </p>
            <div
              style={{
                background: "#ECFDF5",
                border: "1px solid #BBF7D0",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12,
                color: "#065F46",
                lineHeight: 1.65,
              }}
            >
              <div>✓ 可隨時還原（資料保留，不是刪除）</div>
              <div>✓ 在分析頁打開「含測試點擊」就能查看</div>
              <div style={{ color: "#92400E" }}>⚠ KPI 跟趨勢圖會立刻顯示 0</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  height: 36,
                  background: "white",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "var(--ink-300)",
                  cursor: "pointer",
                }}
              >
                取消
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  height: 36,
                  background: "#D97706",
                  border: 0,
                  borderRadius: 8,
                  fontSize: 13,
                  color: "white",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <RotateCcw size={13} /> 確認重設
              </button>
            </div>
          </div>
        </div>

        <h3>它做什麼</h3>
        <ul>
          <li>把這個 campaign 旗下所有連結的<strong>實際點擊</strong>一次標為測試（資料保留，不是刪除）</li>
          <li>KPI / 趨勢圖立刻歸 0</li>
          <li>記在 audit log，誰、什麼時候、影響幾筆都有紀錄</li>
        </ul>

        <h3>為什麼是 soft reset 而不是 delete</h3>
        <ul>
          <li>
            <strong>可還原</strong>：手抖按錯可以救回來
          </li>
          <li>
            <strong>不破壞 conversion 鏈</strong>：sessionId 還在，原本歸因到這次 click 的 conversion 還能查
          </li>
          <li>
            <strong>未來想 forensic 看「launch 前測試的流量分布長怎樣」還能看</strong>（在 analytics 打開 toggle）
          </li>
        </ul>

        <h3>權限</h3>
        <p>
          只有 workspace OWNER / ADMIN 能執行（防止誤觸 / 惡意重設）。MEMBER 看得到按鈕但會回 403。
        </p>

        <h3>還原</h3>
        <p>
          目前 V1 還原要透過 API 直接呼叫（mode: <code>&quot;restore&quot;</code>，可選 batchId 指定還原哪一次）。
          UI 還原按鈕之後會補。
        </p>
      </section>

      <section className="note-section">
        <h2>FAQ / 邊界情況</h2>

        <h3>Q: 測試點擊會出現在 conversion 歸因嗎？</h3>
        <p>
          會 — Click row 還在，sessionId 還在，落地頁的 <code>track.js</code> 一樣可以 attribute conversion。
          只是這個 click 在分析端被當測試流量看待。
        </p>

        <h3>Q: 測試點擊會 burn 掉 maxClicks 配額嗎？</h3>
        <p>
          不會。測試點擊不會遞增 <code>ShortLink.clickCount</code>，也不會撞到設定的 max clicks 上限。
        </p>

        <h3>Q: 我用「測試短網址」開啟連結，目的網址會看到 <code>_test=1</code> 嗎？</h3>
        <p>
          不會。redirect handler 在轉址前會把 <code>_test=1</code> 從目的 URL 拿掉，落地頁的 GA / 任何 analytics 都不會收到這個參數。
        </p>

        <h3>Q: 我在 incognito / 別的瀏覽器點短網址，會被自動標為測試嗎？</h3>
        <p>
          不會。自動偵測靠 NextAuth cookie，沒登入的瀏覽器看起來就是一般 visitor。
          這時要用「測試短網址」按鈕（帶 <code>?_test=1</code>）才會標。
        </p>

        <h3>Q: 客戶不小心收到帶 <code>?_test=1</code> 的網址會怎樣？</h3>
        <p>
          那次點擊會被算成測試（不入正式分析）。但 redirect 仍正常進行，使用者體驗不受影響。
          複製按鈕跟外部分享機制都不會主動帶這個 flag —— 只有「測試」入口才會。
        </p>

        <h3>Q: 我重設後，已經發出去的廣告點擊會被一併重設嗎？</h3>
        <p>
          會 — 重設是針對「現在 DB 裡所有實際點擊」一次標為測試，不分 click 是哪裡來的。
          所以建議在<strong>正式上線前</strong>做最後一次 reset，上線後就不要重設。
        </p>
      </section>

      <section className="note-section">
        <h2>技術細節（給好奇的人）</h2>
        <ul>
          <li>DB schema：<code>Click.isInternal: Boolean @default(false)</code> + <code>Click.resetBatchId: String?</code></li>
          <li>Index：<code>(isInternal, timestamp)</code> + <code>(resetBatchId)</code> 確保過濾 query 走 index</li>
          <li>API filter：<code>?includeInternal=1</code> 加在 <code>/api/analytics/raw</code>、<code>/api/analytics/campaigns-summary</code>、<code>/api/links</code></li>
          <li>Cache key：所有相關 endpoint 的 cache key 都帶 <code>real-only</code> / <code>with-internal</code> segment 隔離</li>
          <li>Redirect handler：<code>/s/[code]</code> 偵測 <code>?_test=1</code> + NextAuth session 雙路徑</li>
          <li>Reset endpoint：<code>POST /api/utm-campaigns/[name]/reset-clicks</code>，接 <code>{`{ mode: "reset" | "restore", batchId? }`}</code></li>
        </ul>
      </section>

      <footer className="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-400">
        <p>
          這個 note 跟著功能一起更新。有疑問或想新增情境，找 Terrel。
        </p>
      </footer>

      <style>{`
        .note-article {
          max-width: 760px;
          margin: 0 auto;
          font-size: 15px;
          line-height: 1.7;
          color: var(--ink-200);
        }
        .note-section {
          margin-bottom: 40px;
        }
        .note-section h2 {
          font-size: 22px;
          font-weight: 600;
          color: var(--ink-100);
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
        }
        .note-section h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--ink-100);
          margin: 24px 0 10px;
        }
        .note-section p {
          margin-bottom: 12px;
        }
        .note-section ul {
          list-style: disc;
          padding-left: 24px;
          margin-bottom: 12px;
        }
        .note-section ul li {
          margin-bottom: 6px;
        }
        .note-section code {
          font-family: var(--font-mono);
          font-size: 13px;
          background: var(--bg-subtle);
          padding: 1px 6px;
          border-radius: 4px;
          color: var(--brand-700);
        }
        .note-section pre {
          font-family: var(--font-mono);
          font-size: 13px;
          background: var(--bg-subtle);
          border: 1px solid var(--border);
          padding: 10px 14px;
          border-radius: 6px;
          margin: 12px 0;
          overflow-x: auto;
        }
        .note-section blockquote {
          border-left: 3px solid var(--brand-500);
          padding: 8px 16px;
          margin: 12px 0;
          background: var(--bg-subtle);
          font-size: 14px;
          color: var(--ink-300);
        }
        .note-callout {
          background: var(--bg-subtle);
          border: 1px solid var(--border);
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 14px;
          color: var(--ink-300);
        }
        /* Inline UI mockups — visualize the actual components without
           shipping screenshots. Stay in sync with the design tokens. */
        .mock-frame {
          margin: 14px 0 22px;
          padding: 18px 18px 20px;
          background: #fff;
          border: 1px dashed var(--border);
          border-radius: 10px;
          position: relative;
        }
        .mock-label {
          position: absolute;
          top: -9px;
          left: 14px;
          padding: 1px 8px;
          background: #fff;
          font-size: 11px;
          color: var(--ink-500);
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .mock-frame-dialog {
          background: var(--bg-subtle);
        }
        .mock-menu-item {
          padding: 6px 12px;
          color: var(--ink-200);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .mock-menu-highlight {
          background: rgba(3, 169, 244, 0.06);
          color: var(--brand-700);
          font-weight: 500;
        }
        .mock-toggle {
          height: 32px;
          padding: 0 10px;
          font-size: 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--border);
          border-radius: 7px;
          color: var(--ink-400);
          background: white;
        }
        .mock-toggle-on {
          color: var(--brand-700);
          border-color: var(--brand-500);
          background: rgba(3, 169, 244, 0.06);
        }
        .mock-checkbox {
          width: 14px;
          height: 14px;
          border: 1.5px solid currentColor;
          border-radius: 3px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          line-height: 1;
        }
        .mock-toggle-on .mock-checkbox-on {
          background: var(--brand-700);
          border-color: var(--brand-700);
          color: white;
        }
      `}</style>
    </article>
  );
}
