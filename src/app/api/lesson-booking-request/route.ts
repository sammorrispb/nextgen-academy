import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getStripe } from "@/lib/stripe";
import {
  signBookingToken,
  BOOKING_TIME_OPTIONS,
  type BookingRequestPayload,
  type BookingSlot,
} from "@/lib/lesson-booking-token";
import {
  sendBookingRequestAdminEmail,
  sendBookingRequestParentEmail,
} from "@/lib/lesson-booking-notify";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";

/**
 * POST /api/lesson-booking-request
 *
 * The parent proposes up to 3 date/times for a PAID lesson invoice. The
 * invoice metadata becomes the booking state machine:
 *   (none) → requested → confirmed | countered → confirmed
 * A signed request token goes to both admin inboxes with the coach
 * confirm/counter link; the parent gets a "request received" email.
 */

const MAX_SLOTS = 3;
const MAX_ADVANCE_DAYS = 60;

function todayIsoET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function isValidSlotDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const today = todayIsoET();
  const min = addDaysIso(today, 1); // no same-day bookings
  const max = addDaysIso(today, MAX_ADVANCE_DAYS);
  return date >= min && date <= max;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const invoiceId = typeof b.invoiceId === "string" ? b.invoiceId.trim() : "";
  const requestId =
    typeof b.requestId === "string" && b.requestId.length > 0
      ? b.requestId
      : randomUUID();
  const notes =
    typeof b.notes === "string" ? b.notes.trim().slice(0, 500) : "";
  const rawSlots = Array.isArray(b.slots) ? b.slots : [];

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoice" }, { status: 400 });
  }

  const slots: BookingSlot[] = [];
  const seen = new Set<string>();
  for (const s of rawSlots) {
    if (slots.length >= MAX_SLOTS) break;
    const o = s as Record<string, unknown>;
    const date = typeof o.date === "string" ? o.date : "";
    const time = typeof o.time === "string" ? o.time : "";
    if (!isValidSlotDate(date)) {
      return NextResponse.json(
        { error: `Pick a date between tomorrow and ${MAX_ADVANCE_DAYS} days out.` },
        { status: 400 },
      );
    }
    if (!(BOOKING_TIME_OPTIONS as readonly string[]).includes(time)) {
      return NextResponse.json({ error: "Pick a valid start time." }, { status: 400 });
    }
    const key = `${date} ${time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({ date, time });
  }
  if (slots.length === 0) {
    return NextResponse.json(
      { error: "Propose at least one date and time." },
      { status: 400 },
    );
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Booking is unavailable right now." }, { status: 503 });
  }

  const stripe = getStripe();
  let invoice;
  try {
    invoice = await stripe.invoices.retrieve(invoiceId);
  } catch {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  const m = invoice.metadata ?? {};
  if (m.kind !== "lesson") {
    return NextResponse.json({ error: "This booking page is for lessons." }, { status: 400 });
  }
  if (invoice.status !== "paid") {
    return NextResponse.json(
      {
        error: "This invoice isn't paid yet — pay it first, then pick your time.",
        code: "unpaid",
        payUrl: invoice.hosted_invoice_url ?? undefined,
      },
      { status: 402 },
    );
  }
  if (m.booking_status === "confirmed") {
    return NextResponse.json(
      { error: "This lesson already has a confirmed time.", code: "already_confirmed" },
      { status: 409 },
    );
  }
  // Retry-safe: the same requestId stamping twice means the first attempt
  // already sent the emails — don't send them again.
  if (m.booking_request_id === requestId && m.booking_status === "requested") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const parentEmail = invoice.customer_email ?? String(m.parent_email ?? "");
  const payload: BookingRequestPayload = {
    v: 1,
    type: "request",
    requestId,
    invoiceId: invoice.id,
    parentName: String(m.parent_name ?? ""),
    parentEmail,
    parentPhone: String(m.parent_phone ?? ""),
    childFirstName: String(m.child_first_name ?? ""),
    lessonType: String(m.lesson_type ?? ""),
    lessonTitle: String(m.lesson_title ?? "Lesson"),
    slots,
    notes,
    createdAt: new Date().toISOString(),
  };
  if (!EMAIL_RE.test(payload.parentEmail)) {
    return NextResponse.json({ error: "We couldn't find a parent email on this invoice — text Coach Sam at 301-325-4731." }, { status: 422 });
  }

  const token = signBookingToken(payload);
  if (!token) {
    return NextResponse.json(
      { error: "Booking is unavailable right now — text Coach Sam at 301-325-4731." },
      { status: 503 },
    );
  }

  // The invoice metadata is the booking state machine. Stamp first so a
  // retry can't double-send the admin email.
  try {
    await stripe.invoices.update(invoice.id, {
      metadata: { booking_status: "requested", booking_request_id: requestId },
    });
  } catch (err) {
    console.error("[lesson-booking-request] metadata stamp failed", err);
    return NextResponse.json(
      { error: "We couldn't save your request — try again in a minute." },
      { status: 502 },
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";
  const decideUrl = `${origin}/lessons/book/confirm?token=${encodeURIComponent(token)}`;

  await Promise.allSettled([
    sendBookingRequestAdminEmail(payload, decideUrl),
    sendBookingRequestParentEmail(payload),
    ingestToOpenBrain({
      business: "nga",
      source: "nga_lesson_booking_request",
      name: payload.parentName,
      email: payload.parentEmail,
      phone: payload.parentPhone || undefined,
      interest: payload.lessonTitle,
      metadata: {
        invoice_id: invoice.id,
        request_id: requestId,
        child_first_name: payload.childFirstName,
        proposed_slots: slots.map((s) => `${s.date} ${s.time}`),
        notes: notes || undefined,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
