import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { verifyBookingToken } from "@/lib/lesson-booking-token";
import {
  sendBookingConfirmedParentEmail,
  sendBookingConfirmedAdminEmail,
  sendDeclineAdminEmail,
} from "@/lib/lesson-booking-notify";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";

/**
 * POST /api/lesson-booking-respond
 *
 * The parent accepts or declines the coach's counter-offer.
 * Token-authenticated. State-guarded: the invoice must still be `countered`
 * for THIS requestId — if the coach already confirmed something else, or the
 * parent already responded, the link is dead.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { token, decision } = body as { token?: string; decision?: string };

  const payload = typeof token === "string" ? verifyBookingToken(token) : null;
  if (!payload || payload.type !== "counter") {
    return NextResponse.json({ error: "This link is invalid." }, { status: 400 });
  }
  if (decision !== "accept" && decision !== "decline") {
    return NextResponse.json({ error: "Pick accept or decline." }, { status: 400 });
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
  if (m.booking_request_id !== payload.requestId || m.booking_status !== "countered") {
    return NextResponse.json(
      { error: "This offer is no longer active — your coach will be in touch." },
      { status: 409 },
    );
  }

  if (decision === "accept") {
    try {
      await stripe.invoices.update(invoice.id, {
        metadata: {
          booking_status: "confirmed",
          booking_date: payload.date,
          booking_time: payload.time,
        },
      });
    } catch (err) {
      console.error("[lesson-booking-respond] confirm stamp failed", err);
      return NextResponse.json({ error: "Couldn't save — try again." }, { status: 502 });
    }
    const confirmed = {
      childFirstName: payload.childFirstName,
      lessonTitle: payload.lessonTitle,
      date: payload.date,
      time: payload.time,
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
          confirmed_slot: `${payload.date} ${payload.time}`,
          via: "counter_accept",
        },
      }),
    ]);
    return NextResponse.json({ ok: true, decision: "accept", date: payload.date, time: payload.time });
  }

  // Decline: back to `requested` so the coach sees it needs personal follow-up.
  try {
    await stripe.invoices.update(invoice.id, {
      metadata: { booking_status: "requested" },
    });
  } catch (err) {
    console.error("[lesson-booking-respond] decline stamp failed", err);
    return NextResponse.json({ error: "Couldn't save — try again." }, { status: 502 });
  }
  await Promise.allSettled([sendDeclineAdminEmail(payload)]);
  return NextResponse.json({ ok: true, decision: "decline" });
}
