/**
 * Campaign Kickstart templates — the default channel mix per campaign
 * type. Kept in line with the campaign-link-planner skill
 * (skills/campaign-link-planner/references/type-*.md + utm-rules.md):
 * change one, change the other.
 *
 * Team conventions baked in:
 *   - EDM source is `mailchimp` (the tool the team actually sends with;
 *     mixing `newsletter` and `mailchimp` split Computex's report in two)
 *   - organic social is LinkedIn first; Facebook is opt-in
 *   - exhibitions run pre-show → on-site QR → post-show, tagged by phase
 *
 * Labels live in messages/*.json under `kickstart.channels.<key>`.
 */

export type CampaignType = "exhibition" | "launch";

/** Phase = a step of the campaign's timeline; doubles as a link tag. */
export type Phase = "pre" | "live" | "post" | "launch" | "follow" | "extra";

export interface TemplateChannel {
  /** Unique within a template; i18n key under kickstart.channels. */
  key: string;
  phase: Phase;
  medium: string;
  source: string;
  content: string;
  /** Readable short-code suffix, appended to the campaign prefix (e.g. ise27-booth). */
  code: string;
  /** Ticked by default? Paid / optional rows start unticked. */
  on: boolean;
  /**
   * Physical QR positions usually point to different pages (product,
   * demo booking, LinkedIn…), so the wizard asks for a destination.
   */
  ownUrl?: boolean;
}

export interface CampaignTemplate {
  type: CampaignType;
  /** Phases in timeline order (sections in the channel step). */
  phases: Phase[];
  channels: TemplateChannel[];
}

const EXHIBITION: CampaignTemplate = {
  type: "exhibition",
  phases: ["pre", "live", "post", "extra"],
  channels: [
    { key: "edmSaveTheDate", phase: "pre", medium: "email", source: "mailchimp", content: "save_the_date", code: "edm-1", on: true },
    { key: "edmReminder", phase: "pre", medium: "email", source: "mailchimp", content: "reminder", code: "edm-2", on: true },
    { key: "liTeaser", phase: "pre", medium: "social", source: "linkedin", content: "teaser", code: "li-teaser", on: true },
    { key: "qrBoothFront", phase: "live", medium: "qr", source: "poster", content: "booth_front", code: "booth", on: true, ownUrl: true },
    { key: "qrBoothDemo", phase: "live", medium: "qr", source: "poster", content: "booth_demo", code: "demo", on: true, ownUrl: true },
    { key: "qrBrochure", phase: "live", medium: "qr", source: "flyer", content: "brochure", code: "brochure", on: false, ownUrl: true },
    { key: "qrNamecard", phase: "live", medium: "qr", source: "namecard", content: "staff", code: "card", on: false, ownUrl: true },
    { key: "edmPostEvent", phase: "post", medium: "email", source: "mailchimp", content: "post_event", code: "edm-3", on: true },
    { key: "liRecap", phase: "post", medium: "social", source: "linkedin", content: "recap", code: "li-recap", on: true },
    { key: "prRelease", phase: "extra", medium: "referral", source: "pr", content: "press", code: "pr", on: false },
    { key: "partnerInvite", phase: "extra", medium: "referral", source: "partner", content: "invite", code: "partner", on: false },
    { key: "liAds", phase: "extra", medium: "cpc", source: "linkedin", content: "visual_a", code: "li-ads", on: false },
  ],
};

const LAUNCH: CampaignTemplate = {
  type: "launch",
  phases: ["launch", "follow", "extra"],
  channels: [
    { key: "liAnnounce", phase: "launch", medium: "social", source: "linkedin", content: "announce", code: "li-1", on: true },
    { key: "edmAnnounce", phase: "launch", medium: "email", source: "mailchimp", content: "announce", code: "edm-1", on: true },
    { key: "prRelease", phase: "launch", medium: "referral", source: "pr", content: "press", code: "pr", on: true },
    { key: "intercom", phase: "launch", medium: "referral", source: "intercom", content: "app", code: "app", on: true },
    { key: "liFollowup", phase: "follow", medium: "social", source: "linkedin", content: "followup", code: "li-2", on: true },
    { key: "edmFollowup", phase: "follow", medium: "email", source: "mailchimp", content: "followup", code: "edm-2", on: true },
    { key: "fbAnnounce", phase: "extra", medium: "social", source: "facebook", content: "announce", code: "fb-1", on: false },
    { key: "liAds", phase: "extra", medium: "cpc", source: "linkedin", content: "visual_a", code: "li-ads", on: false },
    { key: "googleAds", phase: "extra", medium: "cpc", source: "google", content: "search", code: "g-ads", on: false },
  ],
};

/**
 * Link tags the wizard adds. Fixed strings (not translated) — tags are
 * shared data, and a zh user and an en user must produce the same tag
 * or the "filter by tag" workflow breaks. Same names as the skill
 * (references/utm-rules.md → tags).
 */
export const PHASE_TAGS: Partial<Record<Phase, string>> = {
  pre: "展前",
  live: "現場QR",
  post: "展後",
  launch: "發表",
  follow: "追蹤",
};
export const PAGE_PENDING_TAG = "待換活動頁";

export const TEMPLATES: Record<CampaignType, CampaignTemplate> = {
  exhibition: EXHIBITION,
  launch: LAUNCH,
};
