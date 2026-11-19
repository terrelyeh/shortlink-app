# Zeabur 資安事件紀錄（2026-08-27 事件，08-31 處理）

> 從 CLAUDE.md 拆出。CLAUDE.md 的 Next Steps 只保留待辦摘要。

這個專案早期部署在 Zeabur，後來搬到 Vercel 但 **DB 一直是同一個 Supabase**。Zeabur 遭入侵導致該專案的 `DATABASE_URL` 外洩，而搬家時沒換過密碼 → 外洩的憑證在事件當下是有效的。

- ✅ 已完成：Supabase 密碼輪替、Vercel `DATABASE_URL`/`DIRECT_URL` 更新 + redeploy、清空所有 Session（17 筆）、刪除所有 Zeabur 專案
- **當時 Zeabur 有哪些變數（Zeabur 專案已刪、無法再查，以下由 git history 重建）**：`zeabur.json` 加於 2026-01-18、Vercel env 建於 04-17~18，所以 Zeabur 時期的集合 = commit `bb1c1ab` 的 `.env.example` 七項：`DATABASE_URL` / `AUTH_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `IP_HASH_SALT` / `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SHORT_URL`。
  **Upstash token（04-18 引入）與 `BOOTSTRAP_EMAILS`（04-23 引入）都晚於搬家，從未進過 Zeabur — 不需輪替。**
- ⬜ 待辦：查 Supabase 連線紀錄有無異常來源。剩下三個機密都**不符合** Zeabur 信中的比對條件（名稱清單 + AWS/GitHub/Anthropic/OpenRouter/OpenAI/Stripe 值格式），但那是**第二封、範圍已擴大過一次**的通知，不宜全信：
  - `AUTH_SECRET` — **建議輪替**（`openssl rand -base64 32` → 更新 Vercel → redeploy）
  - `GOOGLE_CLIENT_SECRET` — 看保守程度。Google Cloud Console 加新 secret → 更新 Vercel → 驗證登入 → 才刪舊的
  - `IP_HASH_SALT` — 傾向不動，見下
- ⚠️ **`IP_HASH_SALT` 若外洩要特別處理** — salt 一旦已知，4,000+ 筆 `Click.ipHash` 就能被反推回真實 IP（IPv4 只有 2^32），等於「匿名點擊紀錄」變成「可識別個人的瀏覽紀錄」。輪替 salt 會讓新舊 hash 對不起來，要接受去重統計斷一次
- 💡 **輪替 `AUTH_SECRET` 的最佳時機是「剛清空 session 之後」** — 它簽章 session cookie，平常換會把所有人踢出去；session 已經是空的時候換，額外成本為零
