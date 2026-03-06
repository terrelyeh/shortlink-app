Review this session's work and update CLAUDE.md to reflect the latest project state.

## Steps

1. Run `git log --oneline -20` to see recent commits.

2. Read the following files in order:
   - `CLAUDE.md` (current project context)
   - `REVIEW_PLAN.md` (feature checklist — sections 一、二、二-B)

3. Based on what was done, update `CLAUDE.md`:

   **In "✅ 已完成" section**: Add any newly completed features from this session.

   **In "⚠️ 待完成 / 已知缺陷" section**: Remove items that are now done; add newly discovered issues.

   **In "常見陷阱" section**: Add any new gotchas discovered this session (e.g. wrong Prisma model names, API quirks).

   **"開發分支" section**: Update branch name if it changed.

4. Also check if `REVIEW_PLAN.md` needs updates:
   - Mark any newly completed F-items (F1–F18) or N-items with ✅ and ~~strikethrough~~
   - Add new N-items (N4, N5…) if new features were implemented beyond the original plan

5. Run `git diff CLAUDE.md REVIEW_PLAN.md` to summarise changes.

6. Ask the user: "要 commit 這次的 context 更新嗎？（CLAUDE.md / REVIEW_PLAN.md）"
   If yes, stage only those files and commit:
   ```
   git add CLAUDE.md REVIEW_PLAN.md
   git commit -m "docs: sync context after session — {one-line summary of what changed}"
   ```

## Key facts about this project

- Prisma models: use `tagOnLink` (not `linkTag`), `tagOnCampaign` (not `campaignTag`)
- All dashboard pages live under `src/app/[locale]/(dashboard)/`
- Zeabur runs `prisma db push` automatically on every deploy — no manual migration needed
- Related docs: `PRODUCT_BRIEF.md` (EN), `docs/product-brief.md` (ZH-TW)
- If significant new features were added, also update the relevant sections in both product brief files

## Scope

Only update what actually changed this session. Do not rewrite sections that are still accurate. Keep CLAUDE.md under ~200 lines.
