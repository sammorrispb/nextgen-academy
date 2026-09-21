import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  verifyBookingToken,
  signBookingToken,
  BOOKING_TIME_OPTIONS,
  type CounterOfferPayload,
} from "@/lib/lesson-booking-token";
import {
  sendCounterOfferParentEmail,
  sendCounterOfferAdminEmail,
} from "@/lib/lesson-booking-notify";

/**
 * POST /api/lesson-booking-counter
 *
 * The coach proposes a different date/time. Token-authenticated. The parent
 * gets accept/decline links; the invoice moves to `countered` for THIS
 * requestId so the original confirm link goes stale.
 */

function todayIsoET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { token, date, time, note } = body as {
    token?: string;
    date?: string;
    time?: string;
    note?: string;
  };

  const payload = typeof token === "string" ? verifyBookingToken(token) : null;
  if (!payload || payload.type !== "request") {
    return NextResponse.json({ error: "This link is invalid." }, { status: 400 });
  }

  const today = todayIsoET();
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date < addDaysIso(today, 1) ||
    date > addDaysIso(today, 60)
  ) {
    return NextResponse.json({ error: "Pick a date between tomorrow and 60 days out." }, { status: 400 });
  }
  if (typeof time !== "string" || !(BOOKING_TIME_OPTIONS as readonly string[]).includes(time)) {
    return NextResponse.json({ error: "Pick a valid start time." }, { status: 400 });
  }
  const cleanNote = typeof note === "string" ? note.trim().slice(0, 500) : "";

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

  const counter: CounterOfferPayload = {
    v: 1,
    type: "counter",
    requestId: payload.requestId,
    invoiceId: payload.invoiceId,
    parentName: payload.parentName,
    parentEmail: payload.parentEmail,
    parentPhone: payload.parentPhone,
    childFirstName: payload.childFirstName,
    lessonTitle: payload.lessonTitle,
    date,
    time,
    note: cleanNote,
    createdAt: new Date().toISOString(),
  };
  const counterToken = signBookingToken(counter);
  if (!counterToken) {
    return NextResponse.json({ error: "Couldn't create the counter-offer link." }, { status: 503 });
  }

  try {
    await stripe.invoices.update(invoice.id, {
      metadata: {
        booking_status: "countered",
        booking_counter_date: date,
        booking_counter_time: time,
      },
    });
  } catch (err) {
    console.error("[lesson-booking-counter] metadata stamp failed", err);
    return NextResponse.json({ error: "Couldn't save the counter-offer — try again." }, { status: 502 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";
  const base = `${origin}/lessons/book/respond?token=${encodeURIComponent(counterToken)}`;

  await Promise.allSettled([
    sendCounterOfferParentEmail(counter, `${base}&decision=accept`, `${base}&decision=decline`),
    sendCounterOfferAdminEmail(counter),
  ]);

  return NextResponse.json({ ok: true, date, time });
}
