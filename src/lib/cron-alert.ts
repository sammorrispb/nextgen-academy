import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { secretEquals } from "@/lib/secret-compare";
import { sendSms } from "@/lib/sms";

/**
 * Cron-failure alerting wrapper (admin-reduction roadmap Phase 0.1).
 *
 * The incident class this exists for is a SWALLOWED domain failure returned as
 * 200 — a Resend reject console.error'd and forgotten, a Notion flag write that
 * silently didn't stick. Every non-payment cron route wraps its body in
 * `withCronAlert(name, handler)`; the handler reports `{ attempted, succeeded,
 * failures[] }` so PARTIAL failures alert too. On any failure the wrapper
 * emails Sam (CC admin inbox), falls back to SMS if that email itself fails
 * (the "Resend key is dead" case), and returns HTTP 500 so the Vercel cron
 * dashboard shows red.
 *
 * Alert-storm posture (documented in docs/admin-reduction-roadmap.md): there is
 * deliberately NO "already alerted" state store — a persistently failing
 * dependency re-alerts every run. The failure signature lives in the SUBJECT so
 * Gmail threads the repeats; SMS escalates ONLY when the alert email fails,
 * never per-run. Hourly crons additionally cap alert EMAILS to fixed UTC
 * windows via `alertEmailUtcHours` (see CronAlertOptions).
 *
 * NO PII in alert bodies: controlled-vocabulary signatures, counts, page-id
 * refs, and (for unhandled exceptions) error CLASS names only — never raw
 * exception text. The builder renders only signature/ref/detail and scrubs
 * anything email- or phone-shaped from those strings as a backstop.
 */

export interface CronFailure {
  /** Stable machine class ("resend_rejected", "flag_write_failed", …). Goes in
   * the subject so Gmail threads repeat alerts for the same failure. */
  signature: string;
  /** PII-free reference — a Notion page/session row ID, "subscriber#3", … */
  ref?: string;
  /** PII-free error detail. Scrubbed again at render time as a backstop. */
  detail?: string;
}

export interface CronRunResult {
  attempted: number;
  succeeded: number;
  /** THE failure signal. The wrapper derives the run's outcome from
   * `failures.length` alone — a handler signals failure only by pushing
   * entries here (or throwing). There is deliberately no separate `ok` flag
   * to hand-compute (and get wrong) in every route. */
  failures: CronFailure[];
  /** Extra JSON merged into the 200 response body (the route's summary).
   * Failing runs return a fixed generic 500 body — detail stays in logs. */
  body?: Record<string, unknown>;
}

const ALERT_TO = "sam.morris2131@gmail.com";
const ALERT_CC = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";

// Keep a persistently-failing weekly-newsletter run from producing a 950-line
// email — list the first N failures, then a count. Full detail is in the logs.
const MAX_LISTED_FAILURES = 20;

// Fallback SMS target — Sam's ops number (already public in site signatures).
// Override with CRON_ALERT_SMS_TO.
const DEFAULT_SMS_TO = "3013254731";

const EMAILISH_RE = /[^\s@<>,;:"'()[\]]+@[^\s@<>,;:"'()[\]]+\.[A-Za-z]{2,}/g;
// US phone shapes (3-3-4 with optional +1/parens/separators). Deliberately NOT
// a generic long-digit-run match so ISO dates and numeric IDs survive. The
// digit-boundary guards ((?<!\d) / (?!\d)) keep it from redacting a 10-digit
// run INSIDE a longer number — a 13-digit ms timestamp or a long numeric ID
// must survive, while a standalone 10-digit phone still gets caught.
const PHONEISH_RE = /(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;

/** Redact anything email- or phone-shaped. Backstop only — call sites must
 * still pass page IDs + counts + error strings, never parent/child data. */
export function scrubPii(text: string): string {
  return text
    .replace(EMAILISH_RE, "[email redacted]")
    .replace(PHONEISH_RE, "[phone redacted]");
}

/** Roll many same-kind per-row failures into ONE alert entry carrying the
 * count + PII-free refs (Notion page ids), so a batch-wide condition — e.g.
 * rows imported with malformed parent emails — alerts once per run instead of
 * once per row. Returns null when there is nothing to report. */
export function rollupFailure(
  signature: string,
  refs: string[],
  what: string,
): CronFailure | null {
  if (refs.length === 0) return null;
  const shown = refs.slice(0, MAX_LISTED_FAILURES);
  const more = refs.length - shown.length;
  return {
    signature,
    detail: `${refs.length} ${what}: ${shown.join(", ")}${more > 0 ? ` …and ${more} more` : ""}`,
  };
}

function signatureSummary(failures: CronFailure[]): string {
  const sigs = [...new Set(failures.map((f) => f.signature || "unspecified_failure"))].sort();
  return sigs.join("+") || "unspecified_failure";
}

export function buildCronAlertEmail(
  name: string,
  result: Pick<CronRunResult, "attempted" | "succeeded" | "failures">,
): { subject: string; text: string } {
  const failures = result.failures.length
    ? result.failures
    : [{ signature: "unspecified_failure" }];
  const subject = scrubPii(`[cron-alert] ${name}: ${signatureSummary(failures)}`);

  const listed = failures.slice(0, MAX_LISTED_FAILURES).map((f) => {
    const parts = [f.signature || "unspecified_failure"];
    if (f.ref) parts.push(`ref ${f.ref}`);
    if (f.detail) parts.push(f.detail);
    return scrubPii(`- ${parts.join(" · ")}`);
  });
  const more = failures.length - listed.length;

  const logsUrl =
    process.env.CRON_ALERT_LOGS_URL ??
    "https://vercel.com/dashboard → project nextgen-academy → Logs";

  const text = [
    `NGA cron failure — ${name}`,
    ``,
    `Attempted: ${result.attempted}`,
    `Succeeded: ${result.succeeded}`,
    `Failed: ${failures.length}`,
    ``,
    `Failures:`,
    ...listed,
    ...(more > 0 ? [`…and ${more} more — see the function logs for the full list.`] : []),
    ``,
    `Logs: ${logsUrl}`,
    `Log filter: [cron/${name}]`,
    ``,
    `This alert repeats on every failing run (no alert-state store; accepted v1 posture).`,
    `Gmail threads repeats via the subject's failure signature.`,
  ].join("\n");

  return { subject, text };
}

export interface DeliverOutcome {
  emailed: boolean;
  sms: "not_attempted" | "sent" | "skipped_not_configured" | "failed";
}

/** Email the alert; if that fails for ANY reason, fall back to a short PII-free
 * SMS. Never throws — alerting must not turn a failing cron into a crash. */
export async function deliverCronAlert(
  name: string,
  result: Pick<CronRunResult, "attempted" | "succeeded" | "failures">,
): Promise<DeliverOutcome> {
  const outcome: DeliverOutcome = { emailed: false, sms: "not_attempted" };
  const { subject, text } = buildCronAlertEmail(name, result);

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: ALERT_TO,
        cc: ALERT_CC,
        replyTo: REPLY_TO,
        subject,
        text,
      });
      if (error) {
        console.error(`[cron-alert] ${name}: alert email rejected`, error.message ?? String(error));
      } else {
        outcome.emailed = true;
      }
    } catch (err) {
      console.error(`[cron-alert] ${name}: alert email threw`, err);
    }
  } else {
    console.error(`[cron-alert] ${name}: RESEND_API_KEY missing — cannot email alert`);
  }

  if (!outcome.emailed) {
    try {
      const sig = signatureSummary(result.failures);
      const res = await sendSms({
        to: process.env.CRON_ALERT_SMS_TO || DEFAULT_SMS_TO,
        // Ops alert to Sam's own number, not a marketing text to a parent —
        // consent is inherent. GSM-7-safe copy (no em-dash) per the SMS cost rule.
        consent: true,
        body: `NGA cron alert: ${name} failed (${sig}) and the alert email also failed. Check Vercel logs.`,
        tag: `cron-alert:${name}`,
      });
      if (res.ok) outcome.sms = "sent";
      else if ("skipped" in res) outcome.sms = "skipped_not_configured";
      else outcome.sms = "failed";
      if (!res.ok) {
        console.error(`[cron-alert] ${name}: SMS fallback did not send`, res);
      }
    } catch (err) {
      outcome.sms = "failed";
      console.error(`[cron-alert] ${name}: SMS fallback threw`, err);
    }
  }

  return outcome;
}

type CronHandler = (req: NextRequest) => Promise<CronRunResult>;

export interface CronAlertOptions {
  /**
   * UTC hours (0–23) during which a failing run may SEND the alert email.
   * Unset = every failing run emails (right for daily/weekly crons).
   *
   * Tradeoff (accepted, deliberate): alert emails share the single Resend
   * 100/day quota with parent-facing mail, so an HOURLY cron with a stuck
   * dependency would re-alert 24–48×/day and could starve booking
   * confirmations. Listing e.g. [0, 6, 12, 18] bounds that to ≤4 alert
   * emails/day per hourly cron, at the cost of up to ~6h of email latency on
   * a new failure — the 500 (red Vercel cron dash) and the console.error'd
   * full alert body remain immediate on EVERY failing run. Stateless and
   * deterministic by design (no "already alerted" store). The SMS fallback is
   * unchanged: it fires only when an ATTEMPTED alert email fails, so a
   * throttled (never-attempted) email cannot trigger SMS.
   */
  alertEmailUtcHours?: number[];
}

/**
 * Wrap a cron route body. Owns the (previously copy-pasted) Bearer-CRON_SECRET
 * gate — byte-identical responses to the inlined version it replaces — then:
 *   failures empty → 200 { ok:true, ...body }
 *   failures > 0   → alert (email → SMS fallback) + a GENERIC 500 body
 *   handler throw  → failure with signature "unhandled_exception"
 *
 * The outcome is derived from `failures.length` alone — handlers never
 * hand-compute an ok flag.
 *
 * PII invariant (detail stays in LOGS): the 500 body is a fixed generic
 * shape and the alert email carries only controlled-vocabulary signatures,
 * counts, refs, and — for unhandled exceptions — the error CLASS name.
 * Raw exception text (which regexes can't reliably scrub of child names;
 * drop-in rows are titled by child) goes to console.error only.
 */
export function withCronAlert(
  name: string,
  handler: CronHandler,
  options: CronAlertOptions = {},
) {
  return async function GET(req: NextRequest): Promise<NextResponse> {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 },
      );
    }
    const auth = req.headers.get("authorization") ?? "";
    if (!secretEquals(auth, `Bearer ${expected}`)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let result: CronRunResult;
    try {
      result = await handler(req);
    } catch (err) {
      // Full raw detail to the logs; only the error CLASS name may ride the
      // alert email (never err.message — it can embed row titles = child names).
      console.error(`[cron/${name}] unhandled exception:`, err);
      result = {
        attempted: 0,
        succeeded: 0,
        failures: [
          {
            signature: "unhandled_exception",
            detail: err instanceof Error ? err.constructor.name : typeof err,
          },
        ],
      };
    }

    if (result.failures.length === 0) {
      return NextResponse.json({ ...(result.body ?? {}), ok: true });
    }

    const hours = options.alertEmailUtcHours;
    const utcHour = new Date().getUTCHours();
    if (hours && !hours.includes(utcHour)) {
      // Quota-throttled window: skip the email but keep the failure loud —
      // full alert body in the logs, 500 below keeps the cron dash red.
      const { subject, text } = buildCronAlertEmail(name, result);
      console.error(
        `[cron-alert] ${name}: alert email skipped (UTC hour ${utcHour} not in [${hours.join(",")}]) — full alert:\n${subject}\n${text}`,
      );
    } else {
      await deliverCronAlert(name, result);
    }

    // Generic on purpose — failure detail lives in the logs + alert email,
    // never in the HTTP response (see the PII invariant above).
    return NextResponse.json(
      { ok: false, cron: name, error: "run failed — see logs" },
      { status: 500 },
    );
  };
}
