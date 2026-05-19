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
 * The booking-confirmation SMS body. Concise — most parents will get the
 * email with the .ics; this is the redundant fast-path on the phone.
 */
export function bookingConfirmationSms(args: {
  childFirst: string;
  sessionTitle: string;
  sessionStart: string;
  sessionDateShort: string; // "Sat May 23"
  detailUrl: string;
}): string {
  return [
    `NGA: ${args.childFirst} is confirmed for ${args.sessionTitle} on ${args.sessionDateShort} at ${args.sessionStart}.`,
    `Details: ${args.detailUrl}`,
    `Reply STOP to opt out.`,
  ].join("\n");
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
  return [
    `${args.childFirst} is on the court tomorrow — ${args.sessionTitle}, ${args.sessionDateShort} at ${args.sessionStart}.`,
    `Water + court shoes. Details: ${args.detailUrl}`,
    `— Coach Sam · NGA · Reply STOP to opt out.`,
  ].join("\n");
}
