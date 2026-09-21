import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { verifyBookingToken } from "@/lib/lesson-booking-token";
import {
  sendBookingConfirmedParentEmail,
  sendBookingConfirmedAdminEmail,
} from "@/lib/lesson-booking-notify";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";

/**
 * POST /api/lesson-booking-confirm
 *
 * The coach picks one of the parent's proposed slots. Token-authenticated
 * (the link lives only in Sam's inboxes). State-guarded: the invoice must
 * still be in `requested` for THIS requestId, so a double-click or a stale
 * link can't confirm twice or clobber a counter-offer already in flight.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { token, slotIndex } = body as { token?: string; slotIndex?: number };

  const payload = typeof token === "string" ? verifyBookingToken(token) : null;
  if (!payload || payload.type !== "request") {
    return NextResponse.json({ error: "This link is invalid." }, { status: 400 });
  }
  const slot =
    typeof slotIndex === "number" ? payload.slots[slotIndex] : undefined;
  if (!slot) {
    return NextResponse.json({ error: "Pick one of the proposed times." }, { status: 400 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Unavailable right now." }, { status: 503 });
  }
  const stripe = getStripe();
  let invoice;
  try {
    invoice = await stripe.invoices.retrieve(payload.invoiceId);
  } catch {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  const m = invoice.metadata ?? {};
  if (m.booking_request_id !== payload.requestId || m.booking_status !== "requested") {
    return NextResponse.json(
      { error: "This request was already handled — check your inbox for the latest status." },
      { status: 409 },
    );
  }

  try {
    await stripe.invoices.update(invoice.id, {
      metadata: {
        booking_status: "confirmed",
        booking_date: slot.date,
        booking_time: slot.time,
      },
    });
  } catch (err) {
    console.error("[lesson-booking-confirm] metadata stamp failed", err);
    return NextResponse.json({ error: "Couldn't save the confirmation — try again." }, { status: 502 });
  }

  const confirmed = {
    childFirstName: payload.childFirstName,
    lessonTitle: payload.lessonTitle,
    date: slot.date,
    time: slot.time,
    parentName: payload.parentName,
    parentEmail: payload.parentEmail,
    parentPhone: payload.parentPhone,
    invoiceId: invoice.id,
  };

  await Promise.allSettled([
    sendBookingConfirmedParentEmail(confirmed),
    sendBookingConfirmedAdminEmail(confirmed),
    ingestToOpenBrain({
      business: "nga",
      source: "nga_lesson_booking_confirmed",
      name: payload.parentName,
      email: payload.parentEmail,
      phone: payload.parentPhone || undefined,
      interest: payload.lessonTitle,
      metadata: {
        invoice_id: invoice.id,
        request_id: payload.requestId,
        child_first_name: payload.childFirstName,
        confirmed_slot: `${slot.date} ${slot.time}`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, date: slot.date, time: slot.time });
}
