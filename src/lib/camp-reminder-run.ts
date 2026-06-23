import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import { CAMPS, CAMP_OPTIONS, findCampBySlug, type Camp } from "@/data/camps";
import {
  upcomingCampForReminder,
  formatCampDayLong,
  formatCampWeekday,
  resolveCampWhere,
} from "@/lib/camp-reminder-schedule";
import {
  collectPaidCampSessions,
  syncCampRoster,
  fetchCampRosterForReminder,
  markCampReminderSent,
  type CampSessionSource,
} from "@/lib/notion-camp-roster";
import {
  campReminderHtml,
  campReminderText,
  campReminderSubject,
} from "@/lib/email/camp-reminder";

/**
 * Core of the Friday-before-camp reminder, split out from the cron route so it
 * runs fully offline in the egress invariant (inject a Stripe stub; Notion +
 * Resend ride globalThis.fetch and stub cleanly). The route does auth + param
 * parsing and calls this. Mirrors the eval-confirmation route/lib split.
 *
 * Recipients are PARENT contacts only. Child fields egress only to Notion (the
 * roster) + Resend (email to the parent) — pinned by
 * e2e/invariant-camp-reminder-egress.spec.ts.
 */

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const REPLY_TO = "nextgenacademypb@gmail.com";

// Door-time policy (Sam, 2026-06-23). The $25 fee is stated as POLICY only —
// no payment link in the reminder.
const DROPOFF_WINDOW = "9:15–9:30 AM";
const PICKUP_WINDOW = "12:30–12:45 PM";
const LATE_FEE = "$25";
const CAMP_HOURS = CAMP_OPTIONS[0].hours; // "9:30 AM – 12:30 PM" (same for both SKUs)
const THROTTLE_MS = 300; // stay under Resend's 5 req/s

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export interface RunCampReminderOpts {
  /** Explicit camp slug (manual runs). When omitted, resolves from `today`. */
  slug?: string;
  /** ET "today" (YYYY-MM-DD). Defaults to the ET calendar date. */
  today?: string;
  dryRun?: boolean;
  /** Restrict the live send to these parent emails (re-run only failures). */
  only?: string[];
  /** Injectable for tests; defaults to the real Stripe client. */
  stripe?: CampSessionSource;
}

export type RunCampReminderResult =
  | { ok: true; skipped: true; reason: string; slug: string | null }
  | {
      ok: true;
      dryRun: true;
      slug: string;
      campTitle: string;
      recipientCount: number;
      recipients: { parentEmail: string; childFirst: string; optionLabel: string }[];
      preview: { subject: string; text: string };
    }
  | {
      ok: true;
      slug: string;
      campTitle: string;
      synced: { scanned: number; paidForSlug: number; created: number; existing: number; failed: number };
      recipientCount: number;
      sent: number;
      failed: number;
    }
  | { ok: false; reason: "resend_unconfigured"; message: string };

function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

function resolveCamp(opts: RunCampReminderOpts): Camp | null {
  if (opts.slug?.trim()) return findCampBySlug(opts.slug.trim()) ?? null;
  return upcomingCampForReminder(opts.today ?? todayET(), CAMPS);
}

export async function runCampReminder(
  opts: RunCampReminderOpts = {},
): Promise<RunCampReminderResult> {
  const camp = resolveCamp(opts);
  if (!camp) {
    return {
      ok: true,
      skipped: true,
      reason: opts.slug
        ? `no camp with slug "${opts.slug}"`
        : "no camp starts 3 days from today",
      slug: opts.slug ?? null,
    };
  }

  const stripe = opts.stripe ?? getStripe();
  const where = resolveCampWhere(camp);
  const startDayLong = formatCampDayLong(camp.startDate);
  const weekday = formatCampWeekday(camp.startDate);
  const makeupDayLong = formatCampDayLong(camp.makeupDate);

  const buildEmail = (parentFirst: string, childFirst: string, optionLabel: string) => {
    const input = {
      parentFirst,
      childFirst,
      campTitle: camp.title,
      campWeek: camp.weekLabel,
      optionLabel,
      optionHours: CAMP_HOURS,
      location: where,
      startDayLong,
      dropoffWindow: DROPOFF_WINDOW,
      pickupWindow: PICKUP_WINDOW,
      lateFee: LATE_FEE,
      makeupDayLong,
    };
    return {
      subject: campReminderSubject(childFirst, weekday),
      html: campReminderHtml(input),
      text: campReminderText(input),
    };
  };

  // DRY RUN: preview the recipient list + a rendered sample straight from
  // Stripe — no Notion writes, no Resend. Lets Sam eyeball the first send.
  if (opts.dryRun) {
    const { entries } = await collectPaidCampSessions(camp.slug, stripe);
    const recipients = entries
      .filter((e) => isEmail(e.parentEmail))
      .map((e) => ({
        parentEmail: e.parentEmail,
        childFirst: e.childFirstName || "your camper",
        optionLabel: e.optionLabel,
      }));
    const sample = recipients[0];
    const preview = buildEmail(
      "there",
      sample?.childFirst ?? "your camper",
      sample?.optionLabel ?? CAMP_OPTIONS[0].label,
    );
    return {
      ok: true,
      dryRun: true,
      slug: camp.slug,
      campTitle: camp.title,
      recipientCount: recipients.length,
      recipients,
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

  // LIVE: sync the roster from Stripe, then send to rows not yet reminded.
  const synced = await syncCampRoster(camp.slug, stripe);
  let recipients = await fetchCampRosterForReminder(camp.slug);
  if (opts.only?.length) {
    const allow = new Set(opts.only.map((e) => e.trim().toLowerCase()));
    recipients = recipients.filter((r) => allow.has(r.parentEmail.toLowerCase()));
  }

  const resend = new Resend(apiKey);
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    if (!isEmail(r.parentEmail)) {
      failed += 1;
      continue;
    }
    if (i > 0) await sleep(THROTTLE_MS);
    const email = buildEmail(r.parentFirst, r.childFirst, r.optionLabel);
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
        console.error("[camp-reminder] Resend rejected", r.parentEmail, error);
        failed += 1;
        continue;
      }
      // Flip the flag only after a successful send so a failure re-qualifies
      // on the next run (drop-in reminder idempotency pattern).
      await markCampReminderSent(r.pageId);
      sent += 1;
    } catch (err) {
      console.error("[camp-reminder] send threw", r.parentEmail, err);
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
        subject: `[Camp reminder sent · ${sent} of ${recipients.length}] ${camp.title}`,
        text: [
          `Friday-before-camp reminder run for ${camp.title} (${camp.weekLabel}).`,
          `Slug: ${camp.slug}`,
          `Roster synced from Stripe — scanned ${synced.scanned}, paid for slug ${synced.paidForSlug}, created ${synced.created}, existing ${synced.existing}, failed ${synced.failed}.`,
          `Reminders: sent ${sent}, failed ${failed}, of ${recipients.length} pending.`,
          `Reconcile the count against paid camp_slug=${camp.slug} sessions in Stripe.`,
        ].join("\n"),
      });
    } catch (err) {
      console.error("[camp-reminder] admin QA copy threw", err);
    }
  }

  return {
    ok: true,
    slug: camp.slug,
    campTitle: camp.title,
    synced,
    recipientCount: recipients.length,
    sent,
    failed,
  };
}
