import { Resend } from "resend";
import { buildDropInIcs } from "@/lib/email/ics";
import { formatLongDate } from "@/lib/format-date";
import type {
  BookingRequestPayload,
  CounterOfferPayload,
} from "@/lib/lesson-booking-token";

/**
 * All emails for the lesson booking-request flow.
 *
 * Every send is best-effort: failures are logged, never thrown, so a Resend
 * hiccup can't strand a booking state transition that already landed on the
 * Stripe invoice metadata.
 */

const ADMIN_NOTIFY = ["nextgenacademypb@gmail.com", "sam.morris2131@gmail.com"];
const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

function resend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[lesson-booking-notify] RESEND_API_KEY missing — skipping email");
    return null;
  }
  return new Resend(apiKey);
}

function slotLabel(date: string, time: string): string {
  return `${formatLongDate(date)} at ${time}`;
}

/** "5:30 PM" + 60 minutes → "6:30 PM". Lessons are one hour. */
function oneHourLater(time: string): string | null {
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = m[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  const total = h * 60 + min + 60;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  const ep = eh >= 12 ? "PM" : "AM";
  const dh = eh % 12 === 0 ? 12 : eh % 12;
  return `${dh}:${String(em).padStart(2, "0")} ${ep}`;
}

function lessonIcs(opts: {
  childFirstName: string;
  lessonTitle: string;
  date: string;
  time: string;
  parentEmail: string;
}): { filename: string; content: string } | null {
  const end = oneHourLater(opts.time);
  if (!end) return null;
  const ics = buildDropInIcs({
    uid: `lesson-${opts.childFirstName.toLowerCase()}-${opts.date}-${Date.now()}@nextgenpbacademy.com`,
    date: opts.date,
    startTime: opts.time,
    endTime: end,
    title: `${opts.lessonTitle} — ${opts.childFirstName} (Next Gen)`,
    location: "Court TBD — your coach will confirm the location",
    description: `${opts.lessonTitle} for ${opts.childFirstName}. Paid via Next Gen Pickleball Academy.`,
    method: "PUBLISH",
  });
  if (!ics) return null;
  return {
    filename: `${opts.childFirstName.toLowerCase()}-lesson-${opts.date}.ics`,
    content: Buffer.from(ics, "utf-8").toString("base64"),
  };
}

/** New booking request → both admin inboxes, with the coach decision link. */
export async function sendBookingRequestAdminEmail(
  p: BookingRequestPayload,
  decideUrl: string,
): Promise<void> {
  const r = resend();
  if (!r) return;
  const slotLines = p.slots.map(
    (s, i) => `  ${i + 1}. ${slotLabel(s.date, s.time)}`,
  );
  const { error } = await r.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_NOTIFY,
    replyTo: REPLY_TO,
    subject: `Lesson booking request: ${p.childFirstName} — ${p.lessonTitle}`,
    text: [
      `${p.parentName} requested times for ${p.childFirstName}'s ${p.lessonTitle.toLowerCase()} (paid).`,
      ``,
      `Proposed times:`,
      ...slotLines,
      p.notes ? `Notes: ${p.notes}` : null,
      ``,
      `Parent: ${p.parentName} — ${p.parentEmail} — ${p.parentPhone}`,
      `Invoice: ${p.invoiceId}`,
      ``,
      `Confirm one of their times or counter with your own:`,
      decideUrl,
    ]
      .filter((l): l is string => l !== null)
      .join("\n"),
  });
  if (error) console.error("[lesson-booking-notify] request admin email rejected", error);
}

/** Request received → parent. */
export async function sendBookingRequestParentEmail(
  p: BookingRequestPayload,
): Promise<void> {
  const r = resend();
  if (!r) return;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.parentEmail)) return;
  const { error } = await r.emails.send({
    from: FROM_EMAIL,
    to: p.parentEmail,
    bcc: ADMIN_EMAIL,
    replyTo: REPLY_TO,
    subject: `We got your lesson time request`,
    text: [
      `Hi ${p.parentName},`,
      ``,
      `We received your time request for ${p.childFirstName}'s ${p.lessonTitle.toLowerCase()}:`,
      ...p.slots.map((s, i) => `  ${i + 1}. ${slotLabel(s.date, s.time)}`),
      ``,
      `A coach will confirm one of these times — or propose a different one — usually within a day. You'll get an email the moment it's locked in.`,
      ``,
      `— Coach Sam, Next Gen Pickleball Academy`,
    ].join("\n"),
  });
  if (error) console.error("[lesson-booking-notify] request parent email rejected", error);
}

export interface ConfirmedLesson {
  childFirstName: string;
  lessonTitle: string;
  date: string;
  time: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  invoiceId: string;
}

/** Time locked in → parent, with a calendar invite. */
export async function sendBookingConfirmedParentEmail(
  c: ConfirmedLesson,
): Promise<void> {
  const r = resend();
  if (!r) return;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.parentEmail)) return;
  const ics = lessonIcs(c);
  const { error } = await r.emails.send({
    from: FROM_EMAIL,
    to: c.parentEmail,
    bcc: ADMIN_EMAIL,
    replyTo: REPLY_TO,
    subject: `Confirmed: ${c.childFirstName}'s lesson — ${slotLabel(c.date, c.time)}`,
    text: [
      `Hi ${c.parentName},`,
      ``,
      `You're on the calendar: ${c.childFirstName}'s ${c.lessonTitle.toLowerCase()} is confirmed for ${slotLabel(c.date, c.time)}.`,
      ``,
      `Your coach will confirm the court location before the lesson. Bring a water bottle and court shoes — we have loaner paddles.`,
      ``,
      `Need to move it? Just reply to this email.`,
      ``,
      `— Coach Sam, Next Gen Pickleball Academy`,
    ].join("\n"),
    ...(ics
      ? {
          attachments: [
            {
              filename: ics.filename,
              content: ics.content,
              contentType: "text/calendar; charset=utf-8; method=PUBLISH",
            },
          ],
        }
      : {}),
  });
  if (error) console.error("[lesson-booking-notify] confirmed parent email rejected", error);
}

/** Time locked in → both admin inboxes. */
export async function sendBookingConfirmedAdminEmail(
  c: ConfirmedLesson,
): Promise<void> {
  const r = resend();
  if (!r) return;
  const { error } = await r.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_NOTIFY,
    replyTo: REPLY_TO,
    subject: `Lesson confirmed: ${c.childFirstName} — ${slotLabel(c.date, c.time)}`,
    text: [
      `Confirmed: ${c.childFirstName}'s ${c.lessonTitle.toLowerCase()} — ${slotLabel(c.date, c.time)}.`,
      ``,
      `Parent: ${c.parentName} — ${c.parentEmail} — ${c.parentPhone}`,
      `Invoice: ${c.invoiceId}`,
      ``,
      `The parent got a confirmation email with a calendar invite.`,
    ].join("\n"),
  });
  if (error) console.error("[lesson-booking-notify] confirmed admin email rejected", error);
}

/** Coach countered → parent, with accept/decline links. */
export async function sendCounterOfferParentEmail(
  p: CounterOfferPayload,
  acceptUrl: string,
  declineUrl: string,
): Promise<void> {
  const r = resend();
  if (!r) return;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.parentEmail)) return;
  const { error } = await r.emails.send({
    from: FROM_EMAIL,
    to: p.parentEmail,
    bcc: ADMIN_EMAIL,
    replyTo: REPLY_TO,
    subject: `A different time for ${p.childFirstName}'s lesson?`,
    text: [
      `Hi ${p.parentName},`,
      ``,
      `Your requested times didn't work, but your coach can do ${slotLabel(p.date, p.time)} for ${p.childFirstName}'s ${p.lessonTitle.toLowerCase()}.`,
      p.note ? `Note from coach: ${p.note}` : null,
      ``,
      `Does that work?`,
      `  Yes, book it: ${acceptUrl}`,
      `  No, that doesn't work: ${declineUrl}`,
      ``,
      `— Coach Sam, Next Gen Pickleball Academy`,
    ]
      .filter((l): l is string => l !== null)
      .join("\n"),
  });
  if (error) console.error("[lesson-booking-notify] counter parent email rejected", error);
}

/** Coach countered → both admin inboxes (paper trail). */
export async function sendCounterOfferAdminEmail(
  p: CounterOfferPayload,
): Promise<void> {
  const r = resend();
  if (!r) return;
  const { error } = await r.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_NOTIFY,
    replyTo: REPLY_TO,
    subject: `Counter-offer sent: ${p.childFirstName} — ${slotLabel(p.date, p.time)}`,
    text: [
      `You countered ${p.parentName}'s request for ${p.childFirstName}'s ${p.lessonTitle.toLowerCase()}:`,
      ``,
      `  ${slotLabel(p.date, p.time)}`,
      p.note ? `  Note: ${p.note}` : null,
      ``,
      `The parent got accept/decline links. You'll hear back here either way.`,
    ]
      .filter((l): l is string => l !== null)
      .join("\n"),
  });
  if (error) console.error("[lesson-booking-notify] counter admin email rejected", error);
}

/** Parent declined the counter → both admin inboxes so the coach follows up. */
export async function sendDeclineAdminEmail(
  p: CounterOfferPayload,
): Promise<void> {
  const r = resend();
  if (!r) return;
  const { error } = await r.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_NOTIFY,
    replyTo: REPLY_TO,
    subject: `Counter declined: ${p.childFirstName} — reach out to reschedule`,
    text: [
      `${p.parentName} declined your counter-offer of ${slotLabel(p.date, p.time)} for ${p.childFirstName}'s ${p.lessonTitle.toLowerCase()}.`,
      ``,
      `Parent: ${p.parentName} — ${p.parentEmail} — ${p.parentPhone}`,
      `Invoice: ${p.invoiceId}`,
      ``,
      `Reach out directly to find a time that works.`,
    ].join("\n"),
  });
  if (error) console.error("[lesson-booking-notify] decline admin email rejected", error);
}

export function bookPageUrl(invoiceId: string): string {
  return `${SITE_ORIGIN}/lessons/book?inv=${encodeURIComponent(invoiceId)}`;
}
