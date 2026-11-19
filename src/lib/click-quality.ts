/**
 * Which recorded clicks count as real traffic.
 *
 * Two kinds of clicks are stored but left out of every number by default:
 *   - isInternal: our own tests (?_test=1, workspace members, campaign reset)
 *   - isSuspectedBot: automated link scanners that got past the UA keyword
 *     list in /s/[code] — mostly corporate mail security gateways that open
 *     every link in an EDM within minutes of delivery.
 *
 * Detection is deliberately one simple, explainable rule. Measured on the
 * production data (2026-11): 1,578 of 2,764 EDM clicks (57%) came from a
 * single desktop "Chrome/79" UA (a 2019 build) across 150+ IPs; no real
 * visitor population still runs Chromium < 100. A burst rule ("same IP hits
 * 3+ links within a minute") was tested and dropped — it mostly caught
 * people browsing several LinkedIn posts.
 */

/** Chromium major versions below this are treated as scanners. Chrome 100 shipped 2022-03. */
export const MIN_REAL_CHROME_MAJOR = 100;

export function isSuspectedBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false; // missing UA is already rejected as a bot upstream
  const m = /(?:Chrome|Chromium|CriOS)\/(\d+)/.exec(ua);
  if (!m) return false;
  return Number(m[1]) < MIN_REAL_CHROME_MAJOR;
}

/**
 * Prisma `where` fragment for clicks that count. `includeExcluded` (the
 * 「含測試與疑似機器點擊」 toggle) turns the filter off entirely.
 */
export function countedClickWhere(includeExcluded: boolean): { isInternal?: false; isSuspectedBot?: false } {
  return includeExcluded ? {} : { isInternal: false, isSuspectedBot: false };
}
