import twilio from "twilio";

/**
 * Twilio SMS wrapper for NGA.
 *
 * Hard-gated on TCPA consent: `sendSms()` will refuse to send unless the
 * caller explicitly passes `consent: true`. The Notion drop-in row carries
 * the verbatim opt-in language (see src/data/sms-consent.ts + the
 * `SMS Consent Text` column) for audit defense.
 *
 * Env-graceful: if any of TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN /
 * TWILIO_FROM_NUMBER are missing, the helper returns `{ ok: false,
 * skipped: "not_configured" }` without throwing. This lets us land the code
 * before 10DLC registration clears at Twilio — Sam flips it on by setting
 * the three env vars in Vercel.
 */

interface SendSmsInput {
  to: string;
  body: string;
  /** TCPA opt-in. Required. If false, the send is refused (not silently dropped). */
  consent: boolean;
  /** Free-form tag for log filtering. */
  tag?: string;
}

export type SendSmsResult =
  | { ok: true; sid: string }
  | { ok: false; skipped: "no_consent" | "not_configured" | "invalid_to" }
  | { ok: false; error: string };

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  if (!input.consent) {
    console.warn("[sms] refused: no consent", { tag: input.tag });
    return { ok: false, skipped: "no_consent" };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.warn("[sms] skipped: TWILIO_* env vars not set", { tag: input.tag });
    return { ok: false, skipped: "not_configured" };
  }

  const to = normalizePhone(input.to);
  if (!to) {
    console.warn("[sms] invalid to-number", { tag: input.tag });
    return { ok: false, skipped: "invalid_to" };
  }

  try {
    const client = twilio(sid, token);
    const msg = await client.messages.create({ to, from, body: input.body });
    return { ok: true, sid: msg.sid };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sms] twilio send failed", { tag: input.tag, message });
    return { ok: false, error: message };
  }
}

/**
 * GSM-7 basic charset. Twilio (and every A2P SMS gateway) picks GSM-7 when
 * the whole body fits this set — 160 chars per segment. ANY char outside
 * this set forces UCS-2 encoding for the WHOLE message — 70 chars per
 * segment, i.e. 3-4× cost per send. That includes brand-friendly chars:
 *   — em-dash, – en-dash, · middle dot, ' ' " " curly quotes, … ellipsis.
 *
 * Keep SMS bodies inside `GSM7_BASIC_RE` so every send stays cheap. Brand
 * voice via word choice, not punctuation. Email bodies have no such limit
 * and can use whatever typography.
 */
const GSM7_BASIC_RE =
  /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà]*$/;

/** Dev-time assert: throw if a body contains chars that would force UCS-2. */
function assertGsm7Safe(body: string, tag: string): void {
  if (process.env.NODE_ENV !== "production" && !GSM7_BASIC_RE.test(body)) {
    const offending = Array.from(body)
      .filter((ch) => !GSM7_BASIC_RE.test(ch))
      .filter((ch, i, a) => a.indexOf(ch) === i)
      .join("");
    throw new Error(
      `[sms/${tag}] body contains non-GSM-7 chars (forces UCS-2): "${offending}". Use ASCII equivalents — see GSM7_BASIC_RE in src/lib/sms.ts.`,
    );
  }
}

/**
 * The booking-confirmation SMS body. Concise — most parents will get the
 * email with the .ics; this is the redundant fast-path on the phone.
 *
 * GSM-7 only (see GSM7_BASIC_RE above). No em-dash, no middle dot.
 */
export function bookingConfirmationSms(args: {
  childFirst: string;
  sessionTitle: string;
  sessionStart: string;
  sessionDateShort: string; // "Sat May 23"
  detailUrl: string;
}): string {
  const body = [
    `${args.childFirst} is locked in for ${args.sessionTitle}, ${args.sessionDateShort} at ${args.sessionStart}.`,
    `Details: ${args.detailUrl}`,
    `- Coach Sam, NGA. Reply STOP to opt out.`,
  ].join("\n");
  assertGsm7Safe(body, "booking-confirmation");
  return body;
}

/**
 * The 24h-out reminder SMS body. Fires once per Confirmed drop-in row where
 * Session Date = tomorrow (America/New_York) AND smsConsent === true AND
 * Reminder Sent === false. Idempotency is the cron's job (flips the
 * "Reminder Sent" flag after a successful send).
 */
export function bookingReminderSms(args: {
  childFirst: string;
  sessionTitle: string;
  sessionStart: string;
  sessionDateShort: string; // "Sat May 23"
  detailUrl: string;
}): string {
  const body = [
    `${args.childFirst} is on the court tomorrow - ${args.sessionTitle}, ${args.sessionDateShort} at ${args.sessionStart}.`,
    `Water + court shoes. Details: ${args.detailUrl}`,
    `- Coach Sam, NGA. Reply STOP to opt out.`,
  ].join("\n");
  assertGsm7Safe(body, "booking-reminder");
  return body;
}

/**
 * Session-cancellation broadcast SMS body. Fired from the /coach UI when
 * Sam pulls a whole session. Consent-gated; refund context lives in the
 * email — SMS just delivers the critical "don't show up" + "refund coming"
 * pair under the 160-char target.
 */
export function sessionCancelledSms(args: {
  childFirst: string;
  sessionTitle: string;
  sessionDateShort: string; // "Sat May 23"
  scheduleUrl: string;
}): string {
  const body = [
    `${args.childFirst}'s ${args.sessionTitle} on ${args.sessionDateShort} is cancelled. Full refund issued, back on your card in 5-10 days.`,
    `Next: ${args.scheduleUrl}`,
    `- Coach Sam, NGA. Reply STOP to opt out.`,
  ].join("\n");
  assertGsm7Safe(body, "session-cancelled");
  return body;
}

/**
 * Per-row cancellation confirmation SMS body. Fired by cancelDropIn() for
 * any of the four cancel paths (parent self-serve, coach one-click, admin
 * curl, Stripe refund webhook). Consent-gated. Suppressed if Cancellation
 * Notified is already true (means PR #68's session-broadcast already
 * covered the parent).
 *
 * Two variants — refund vs. no-refund — surfaced via the status arg.
 */
export function cancelConfirmationSms(args: {
  childFirst: string;
  sessionTitle: string;
  sessionDateShort: string; // "Sat May 23"
  status: "Cancelled" | "Refunded";
  scheduleUrl: string;
}): string {
  const refundLine =
    args.status === "Refunded"
      ? `Full refund issued, back on your card in 5-10 days.`
      : `Seat is open for the next family. Drop-ins are non-refundable, but thanks for calling it early.`;
  const body = [
    `${args.childFirst}'s ${args.sessionTitle} (${args.sessionDateShort}) is cancelled. ${refundLine}`,
    `Next: ${args.scheduleUrl}`,
    `- Coach Sam, NGA. Reply STOP to opt out.`,
  ].join("\n");
  assertGsm7Safe(body, "cancel-confirmation");
  return body;
}
