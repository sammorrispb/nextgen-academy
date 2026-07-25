import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import {
  CAMPS,
  CAMP_OPTIONS,
  CAMP_AGE_MIN,
  CAMP_AGE_MAX,
  findCampBySlug,
  type Camp,
} from "@/data/camps";
import {
  collectPaidCampSessions,
  type CampSessionSource,
} from "@/lib/notion-camp-roster";
import {
  buildCampShareBlurb,
  campFollowupSubject,
  campFollowupHtml,
  campFollowupText,
  type CampFollowupNextCamp,
} from "@/lib/email/camp-followup";

/**
 * Core of the camp conclusion follow-up (Google-review ask + share blurb +
 * next-camp register link), split out from the route so it runs fully offline
 * in the egress invariant — same route/lib split as camp-reminder-run.ts.
 *
 * Manual, secret-gated, dryRun-first — NOT a cron. There's no sent-flag
 * column: recipients are deduped per run (one email per parent, however many
 * SKUs/kids they bought), but a second live run re-sends to everyone. Re-run
 * only failures with `only`.
 *
 * Recipients are PARENT contacts only. Child first names egress only to
 * Resend (email to the parent) — pinned by
 * e2e/invariant-camp-followup-egress.spec.ts.
 */

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN = "https://nextgenpbacademy.com";
const THROTTLE_MS = 300; // stay under Resend's 5 req/s
const CAMP_HOURS = CAMP_OPTIONS[0].hours; // same for both SKUs

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** Latest camp that has finished (endDate <= today ET) — the week to thank. */
export function concludedCampForFollowup(today: string, camps: Camp[]): Camp | null {
  let latest: Camp | null = null;
  for (const camp of camps) {
    if (camp.endDate > today) continue;
    if (!latest || camp.endDate > latest.endDate) latest = camp;
  }
  return latest;
}

/** Earliest camp starting after `camp` ends — the one to promote. */
export function nextCampAfter(camp: Camp, camps: Camp[]): Camp | null {
  let next: Camp | null = null;
  for (const candidate of camps) {
    if (candidate.startDate <= camp.endDate) continue;
    if (!next || candidate.startDate < next.startDate) next = candidate;
  }
  return next;
}

/**
 * Public-surface next-camp block. Reads ONLY publicArea — the share blurb is
 * pasted into listservs, so the exact venue must never enter this shape.
 */
export function toFollowupNextCamp(camp: Camp): CampFollowupNextCamp {
  const day = CAMP_OPTIONS.find((o) => o.key === "day");
  const week = CAMP_OPTIONS.find((o) => o.key === "week");
  return {
    title: camp.title,
    weekLabel: camp.weekLabel,
    publicArea: camp.publicArea,
    hours: CAMP_HOURS,
    registerUrl: `${SITE_ORIGIN}/camp/${camp.slug}`,
    priceDayUsd: day?.priceUsd ?? 50,
    priceWeekUsd: week?.priceUsd ?? 150,
    ageMin: CAMP_AGE_MIN,
    ageMax: CAMP_AGE_MAX,
  };
}

interface FollowupRecipient {
  parentEmail: string;
  parentFirst: string;
  /** Unique child first names for this parent, joined — "Ava & Max". */
  childFirst: string;
}

export interface RunCampFollowupOpts {
  /** Explicit camp slug (manual runs). When omitted, resolves from `today`. */
  slug?: string;
  /** ET "today" (YYYY-MM-DD). Defaults to the ET calendar date. */
  today?: string;
  dryRun?: boolean;
  /** Restrict the live send to these parent emails (re-run only failures). */
  only?: string[];
  /** Override the Google review link; defaults to NGA_GOOGLE_REVIEW_URL. */
  reviewUrl?: string;
  /** Injectable for tests; defaults to the real Stripe client. */
  stripe?: CampSessionSource;
}

export type RunCampFollowupResult =
  | { ok: true; skipped: true; reason: string; slug: string | null }
  | {
      ok: true;
      dryRun: true;
      slug: string;
      campTitle: string;
      nextCampSlug: string | null;
      reviewUrl: string;
      recipientCount: number;
      recipients: { parentEmail: string; childFirst: string }[];
      preview: { subject: string; text: string };
    }
  | {
      ok: true;
      slug: string;
      campTitle: string;
      recipientCount: number;
      sent: number;
      failed: number;
    }
  | {
      ok: false;
      reason: "resend_unconfigured" | "stripe_unconfigured" | "review_url_unconfigured";
      message: string;
    };

function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

export async function runCampFollowup(
  opts: RunCampFollowupOpts = {},
): Promise<RunCampFollowupResult> {
  const today = opts.today ?? todayET();
  const camp = opts.slug?.trim()
    ? (findCampBySlug(opts.slug.trim()) ?? null)
    : concludedCampForFollowup(today, CAMPS);
  if (!camp) {
    return {
      ok: true,
      skipped: true,
      reason: opts.slug
        ? `no camp with slug "${opts.slug}"`
        : "no camp has concluded yet",
      slug: opts.slug ?? null,
    };
  }

  let stripe: CampSessionSource;
  try {
    stripe = opts.stripe ?? getStripe();
  } catch (err) {
    console.error("[camp-followup] Stripe client unavailable", err);
    return {
      ok: false,
      reason: "stripe_unconfigured",
      message: "STRIPE_SECRET_KEY is not configured — refusing to run",
    };
  }

  const configuredReviewUrl =
    opts.reviewUrl?.trim() || process.env.NGA_GOOGLE_REVIEW_URL?.trim() || "";
  // The review ask is the core value of this email — never live-send a
  // broken/placeholder button. dryRun still previews so Sam can see the copy
  // before the Google Business Profile exists.
  if (!opts.dryRun && !configuredReviewUrl) {
    return {
      ok: false,
      reason: "review_url_unconfigured",
      message:
        "NGA_GOOGLE_REVIEW_URL is not configured (and no reviewUrl was passed) — refusing a live send with a broken review link",
    };
  }
  const reviewUrl = configuredReviewUrl || "[set NGA_GOOGLE_REVIEW_URL]";

  const next = nextCampAfter(camp, CAMPS);
  const nextCamp = next ? toFollowupNextCamp(next) : null;
  const shareBlurb = nextCamp
    ? buildCampShareBlurb(nextCamp)
    : // No upcoming camp — the blurb still shares the academy itself.
      [
        "Our kid just wrapped up a week of pickleball camp with Next Gen Pickleball Academy and had a blast — real coaching, tons of court time, and the most encouraging coaches. If your kid is 6–16 and curious about pickleball, start with a free evaluation:",
        "",
        `${SITE_ORIGIN}/free-evaluation`,
      ].join("\n");

  // One email per parent: group paid Stripe sessions by email, merge kid names.
  const { entries } = await collectPaidCampSessions(camp.slug, stripe);
  const byParent = new Map<string, FollowupRecipient & { childNames: string[] }>();
  for (const entry of entries) {
    if (!isEmail(entry.parentEmail)) continue;
    const key = entry.parentEmail.toLowerCase();
    const childName = entry.childFirstName || "";
    const existing = byParent.get(key);
    if (existing) {
      if (childName && !existing.childNames.includes(childName)) {
        existing.childNames.push(childName);
      }
      continue;
    }
    byParent.set(key, {
      parentEmail: entry.parentEmail,
      parentFirst: entry.parentName.split(/\s+/)[0] || "there",
      childFirst: "",
      childNames: childName ? [childName] : [],
    });
  }
  let recipients: FollowupRecipient[] = [...byParent.values()].map((r) => ({
    parentEmail: r.parentEmail,
    parentFirst: r.parentFirst,
    childFirst: r.childNames.join(" & ") || "your camper",
  }));

  const buildEmail = (parentFirst: string, childFirst: string) => {
    const input = {
      parentFirst,
      childFirst,
      campTitle: camp.title,
      campWeek: camp.weekLabel,
      reviewUrl,
      shareBlurb,
      nextCamp,
    };
    return {
      subject: campFollowupSubject(childFirst),
      html: campFollowupHtml(input),
      text: campFollowupText(input),
    };
  };

  if (opts.dryRun) {
    const sample = recipients[0];
    const preview = buildEmail("there", sample?.childFirst ?? "your camper");
    return {
      ok: true,
      dryRun: true,
      slug: camp.slug,
      campTitle: camp.title,
      nextCampSlug: next?.slug ?? null,
      reviewUrl,
      recipientCount: recipients.length,
      recipients: recipients.map((r) => ({
        parentEmail: r.parentEmail,
        childFirst: r.childFirst,
      })),
      preview: { subject: preview.subject, text: preview.text },
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason: "resend_unconfigured",
      message: "RESEND_API_KEY is not configured — refusing to run a live send",
    };
  }

  if (opts.only?.length) {
    const allow = new Set(opts.only.map((e) => e.trim().toLowerCase()));
    recipients = recipients.filter((r) => allow.has(r.parentEmail.toLowerCase()));
  }

  const resend = new Resend(apiKey);
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    if (i > 0) await sleep(THROTTLE_MS);
    const email = buildEmail(r.parentFirst, r.childFirst);
    try {
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: r.parentEmail,
        bcc: ADMIN_EMAIL,
        replyTo: REPLY_TO,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      if (error) {
        console.error("[camp-followup] Resend rejected", r.parentEmail, error);
        failed += 1;
        continue;
      }
      sent += 1;
    } catch (err) {
      console.error("[camp-followup] send threw", r.parentEmail, err);
      failed += 1;
    }
  }

  // Admin QA copy — counts only, no child PII — so Sam can reconcile against
  // the Stripe dashboard. Fail-soft.
  if (sent > 0 || failed > 0) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        replyTo: REPLY_TO,
        subject: `[Camp follow-up sent · ${sent} of ${recipients.length}] ${camp.title}`,
        text: [
          `Camp conclusion follow-up run for ${camp.title} (${camp.weekLabel}).`,
          `Slug: ${camp.slug}`,
          `Review link: ${reviewUrl}`,
          `Next camp promoted: ${next ? `${next.title} (${next.slug})` : "none"}`,
          `Follow-ups: sent ${sent}, failed ${failed}, of ${recipients.length} unique parents.`,
          `No sent-flag column — a re-run re-sends to everyone; retry failures with "only".`,
        ].join("\n"),
      });
    } catch (err) {
      console.error("[camp-followup] admin QA copy threw", err);
    }
  }

  return {
    ok: true,
    slug: camp.slug,
    campTitle: camp.title,
    recipientCount: recipients.length,
    sent,
    failed,
  };
}
