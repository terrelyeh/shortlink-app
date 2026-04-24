/**
 * Campaign Kickstart Playbooks — opinionated channel-mix templates
 * that let a new marketer spin up an entire campaign's set of tracked
 * links with correct UTM from scratch.
 *
 * Extending: add another Playbook to the `PLAYBOOKS` array. Keep the
 * channels aligned with the UTM Parameters Guide (see comms-docs)
 * and the workspace's approved source/medium whitelist.
 */

export interface PlaybookChannel {
  /** Unique within a playbook — used as React key. */
  id: string;
  /** Human-readable channel label shown in the wizard. */
  label: string;
  utmSource: string;
  utmMedium: string;
  utmContent: string;
  /** Optional inline hint (e.g. "A/B variant"). */
  hint?: string;
  /**
   * Whether the row starts checked in the wizard. Defaults to true.
   * Set false for paid-media rows (LinkedIn Ads / Google Ads) — those
   * tend to be set up separately and are not part of every launch.
   */
  defaultInclude?: boolean;
}

export interface Playbook {
  id: string;
  name: string;
  /** One-liner describing when to pick this playbook. */
  description: string;
  /** Suggested utm_campaign prefix (user still enters the specific campaign id). */
  campaignHint: string;
  channels: PlaybookChannel[];
}

/**
 * Product launch — new product introduction with a dedicated landing
 * page and a full digital push.
 */
const PRODUCT_LAUNCH: Playbook = {
  id: "product_launch",
  name: "Product Launch",
  description:
    "New product launch with a landing page + EDM + social + PR + paid media.",
  campaignHint: "<product>_launch_<year>q<quarter>",
  channels: [
    {
      id: "edm_v1",
      label: "EDM #1 — headline A",
      utmSource: "newsletter",
      utmMedium: "email",
      utmContent: "edm_headline_a",
      hint: "Main announcement email",
    },
    {
      id: "edm_v2",
      label: "EDM #2 — headline B",
      utmSource: "newsletter",
      utmMedium: "email",
      utmContent: "edm_headline_b",
      hint: "A/B variant for subject-line testing",
    },
    {
      id: "fb_v1",
      label: "Facebook post #1",
      utmSource: "facebook",
      utmMedium: "social",
      utmContent: "fb_organic_v1",
    },
    {
      id: "fb_v2",
      label: "Facebook post #2",
      utmSource: "facebook",
      utmMedium: "social",
      utmContent: "fb_organic_v2",
      hint: "Second creative / follow-up post",
    },
    {
      id: "li_v1",
      label: "LinkedIn post #1",
      utmSource: "linkedin",
      utmMedium: "social",
      utmContent: "li_organic_v1",
    },
    {
      id: "li_v2",
      label: "LinkedIn post #2",
      utmSource: "linkedin",
      utmMedium: "social",
      utmContent: "li_organic_v2",
      hint: "Second creative / follow-up post",
    },
    {
      id: "pr",
      label: "PR release",
      utmSource: "pr",
      utmMedium: "referral",
      utmContent: "press",
    },
    {
      id: "intercom",
      label: "Intercom in-app",
      utmSource: "intercom",
      utmMedium: "referral",
      utmContent: "app",
    },
    {
      id: "li_ads",
      label: "LinkedIn Ads",
      utmSource: "linkedin",
      utmMedium: "cpc",
      utmContent: "li_ads",
      defaultInclude: false,
    },
    {
      id: "google_ads",
      label: "Google Ads",
      utmSource: "google",
      utmMedium: "cpc",
      utmContent: "google_ads",
      defaultInclude: false,
    },
  ],
};

/**
 * Exhibition / trade-show event — drives awareness + booth traffic.
 */
const EXHIBITION_EVENT: Playbook = {
  id: "exhibition_event",
  name: "Exhibition Event",
  description:
    "Trade show / conference with a dedicated event landing page and pre-event promotion.",
  campaignHint: "<event>_<year>",
  channels: [
    {
      id: "edm_save_date",
      label: "EDM — Save the Date",
      utmSource: "newsletter",
      utmMedium: "email",
      utmContent: "save_the_date",
    },
    {
      id: "edm_reminder",
      label: "EDM — Event Reminder",
      utmSource: "newsletter",
      utmMedium: "email",
      utmContent: "reminder",
      hint: "Sent 1–2 weeks before the event",
    },
    {
      id: "fb_announce",
      label: "Facebook — Announcement",
      utmSource: "facebook",
      utmMedium: "social",
      utmContent: "announce",
    },
    {
      id: "fb_booth",
      label: "Facebook — Booth Tease",
      utmSource: "facebook",
      utmMedium: "social",
      utmContent: "booth_tease",
    },
    {
      id: "li_announce",
      label: "LinkedIn — Announcement",
      utmSource: "linkedin",
      utmMedium: "social",
      utmContent: "announce",
    },
    {
      id: "li_booth",
      label: "LinkedIn — Booth Tease",
      utmSource: "linkedin",
      utmMedium: "social",
      utmContent: "booth_tease",
    },
    {
      id: "pr_event",
      label: "PR release",
      utmSource: "pr",
      utmMedium: "referral",
      utmContent: "press",
    },
    {
      id: "intercom_event",
      label: "Intercom in-app",
      utmSource: "intercom",
      utmMedium: "referral",
      utmContent: "app",
    },
    {
      id: "li_ads_event",
      label: "LinkedIn Ads",
      utmSource: "linkedin",
      utmMedium: "cpc",
      utmContent: "li_ads",
      defaultInclude: false,
    },
    {
      id: "google_ads_event",
      label: "Google Ads",
      utmSource: "google",
      utmMedium: "cpc",
      utmContent: "google_ads",
      defaultInclude: false,
    },
  ],
};

export const PLAYBOOKS: Playbook[] = [PRODUCT_LAUNCH, EXHIBITION_EVENT];

export function getPlaybook(id: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.id === id);
}
