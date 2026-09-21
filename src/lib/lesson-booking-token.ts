import { createHmac } from "node:crypto";
import { secretEquals, signingSecrets } from "./secret-compare";

/**
 * HMAC-signed tokens for the lesson booking-request flow.
 *
 * Two token types, both capability URLs emailed to Sam's inboxes:
 *  - "request": the parent's booking request (up to 3 proposed date/times).
 *    The coach's confirm/counter page verifies this token — no login needed,
 *    the email itself is the auth boundary (same posture as the Notion
 *    cancel-token links).
 *  - "counter": the coach's counter-offer (one date/time + note). Emailed to
 *    the parent with accept/decline links.
 *
 * Tokens are non-expiring (links live in inboxes), but every mutation is
 * state-guarded against the Stripe invoice metadata (`booking_status` +
 * `booking_request_id`), so a stale link can't confirm a request the coach
 * already handled.
 *
 * Signing key: LESSON_BOOKING_TOKEN_SECRET, with verify-fallback to the
 * legacy NGA_ADMIN_SECRET (same pattern as commit-token) so rotating in a
 * dedicated secret never bricks outstanding links.
 */

export interface BookingSlot {
  /** "YYYY-MM-DD" wall date. */
  date: string;
  /** "5:30 PM" 12-hour start time. */
  time: string;
}

/** Bookable lesson start times (1-hour lessons). Shared by the parent form
 * and server-side validation. */
export const BOOKING_TIME_OPTIONS = [
  "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM",
  "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
  "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM",
] as const;

export interface BookingRequestPayload {
  v: 1;
  type: "request";
  requestId: string;
  invoiceId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  lessonType: string;
  lessonTitle: string;
  slots: BookingSlot[];
  notes: string;
  createdAt: string;
}

export interface CounterOfferPayload {
  v: 1;
  type: "counter";
  requestId: string;
  invoiceId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  lessonTitle: string;
  date: string;
  time: string;
  note: string;
  createdAt: string;
}

export type BookingTokenPayload = BookingRequestPayload | CounterOfferPayload;

function secrets(): string[] {
  return signingSecrets("LESSON_BOOKING_TOKEN_SECRET");
}

function encodePayload(p: BookingTokenPayload): string {
  return Buffer.from(JSON.stringify(p), "utf-8").toString("base64url");
}

function decodePayload(encoded: string): BookingTokenPayload | null {
  try {
    const obj = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf-8"),
    ) as Partial<BookingTokenPayload> & { v?: number; type?: string };
    if (obj.v !== 1) return null;
    if (obj.type === "request") {
      const p = obj as Partial<BookingRequestPayload>;
      if (
        !p.requestId ||
        !p.invoiceId ||
        !p.parentEmail ||
        !Array.isArray(p.slots) ||
        p.slots.length < 1 ||
        p.slots.length > 3
      )
        return null;
      return obj as BookingRequestPayload;
    }
    if (obj.type === "counter") {
      const p = obj as Partial<CounterOfferPayload>;
      if (!p.requestId || !p.invoiceId || !p.parentEmail || !p.date || !p.time)
        return null;
      return obj as CounterOfferPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function signBookingToken(payload: BookingTokenPayload): string | null {
  const [secret] = secrets();
  if (!secret) return null;
  const encoded = encodePayload(payload);
  const mac = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${mac}`;
}

export function verifyBookingToken(token: string): BookingTokenPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const ok = secrets().some((s) => {
    const expected = createHmac("sha256", s).update(encoded).digest("base64url");
    return secretEquals(mac, expected);
  });
  if (!ok) return null;
  return decodePayload(encoded);
}
