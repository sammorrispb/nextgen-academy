// POST /api/eval-book — parent self-serve eval booking (admin-reduction
// roadmap Phase 1a). Minor-PII surface, full IPAV — the egress contract is
// pinned by e2e/invariant-eval-book-egress.spec.ts (Notion + Resend only;
// recipients = booking parent + admin inboxes only; child data = first name +
// level only; rate-limited) and third-caller parity by
// e2e/invariant-eval-confirmation-trigger-parity.spec.ts.
//
// Flow: validate → rate limit → claimEvalSlot (claim-then-verify) →
// sendEvalConfirmation() UNCHANGED as its third caller (template + parent
// .ics + admin BCC + fail-soft CRM Eval-Date stamp) → coach booking
// notification with a METHOD:REQUEST .ics. On a lost claim race → 409 and the
// client refetches open slots (GET).

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { validateEvalBookForm } from "@/lib/validate-eval-book";
import {
  claimEvalSlot,
  fetchOpenEvalSlots,
  releaseEvalSlot,
} from "@/lib/notion-eval-slots";
import {
  sendEvalConfirmation,
  formatLongDate,
} from "@/lib/eval-confirmation-send";
import {
  buildEvalBookingRequestIcs,
  evalBookingNotifyHtml,
  evalBookingNotifySubject,
  type EvalBookingNotifyInput,
} from "@/lib/email/eval-booking-notify";

const ADMIN_EMAIL = "sam.morris2131@gmail.com";
const CC_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

const SLOT_TAKEN_MESSAGE =
  "That time was just booked by another family. Pick another open time below.";

// Per-route in-memory rate limit (5/hr, resets on deploy) — shared impl in
// src/lib/rate-limit.ts; same posture as the other public form routes.
const { isRateLimited } = createRateLimiter();

// Coach booking notification — fail-soft: the parent confirmation is the core
// value; a notify miss is logged (and the Booked Notion row still surfaces it).
async function sendCoachNotification(input: EvalBookingNotifyInput): Promise<void> {
  try {
    const ics = buildEvalBookingRequestIcs(input, [ADMIN_EMAIL, CC_EMAIL]);
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      cc: CC_EMAIL,
      replyTo: input.parentEmail,
      subject: evalBookingNotifySubject(input),
      html: evalBookingNotifyHtml(input),
      attachments: ics
        ? [
            {
              filename: `eval-${input.slot.date}.ics`,
              content: Buffer.from(ics, "utf-8").toString("base64"),
              contentType: "text/calendar; charset=utf-8; method=REQUEST",
            },
          ]
        : undefined,
    });
    if (error) {
      console.error("[eval-book] coach notify failed:", error.message ?? error);
    }
  } catch (err) {
    console.error("[eval-book] coach notify error:", err);
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    console.error("[eval-book] RESEND_API_KEY is not configured");
    return NextResponse.json(
      { error: "Booking is not available right now. Please use the contact form." },
      { status: 500 },
    );
  }

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many booking attempts. Please try again later." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Explicit field pick — unknown/extra fields (anything beyond the booking
  // contract, especially extra child data) are dropped HERE, never forwarded.
  const form = {
    slotId: typeof body.slotId === "string" ? body.slotId : "",
    parentName: typeof body.parentName === "string" ? body.parentName : "",
    email: typeof body.email === "string" ? body.email : "",
    phone: typeof body.phone === "string" ? body.phone : "",
    childFirstName:
      typeof body.childFirstName === "string" ? body.childFirstName : "",
    level: typeof body.level === "string" ? body.level : "",
  };

  const errors = validateEvalBookForm(form);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
  }

  const booking = {
    parentName: form.parentName.trim(),
    parentEmail: form.email.trim(),
    parentPhone: form.phone.trim(),
    childFirst: form.childFirstName.trim(),
    level: form.level,
  };

  // ── Claim the slot (claim-then-verify with a booking token; loser path →
  // slot_taken). The same generic 409 also covers a past slot, a page from a
  // foreign database, and an archived row — no oracle. ──
  const claim = await claimEvalSlot(form.slotId.trim(), booking);
  if (!claim.ok) {
    if (claim.reason === "slot_taken") {
      return NextResponse.json({ error: SLOT_TAKEN_MESSAGE }, { status: 409 });
    }
    console.error("[eval-book] claim failed:", claim.detail);
    return NextResponse.json(
      { error: "Couldn't book that time. Please try again in a minute." },
      { status: 502 },
    );
  }
  const { slot, bookingId } = claim;

  // ── Parent confirmation — the shared engine, UNCHANGED (third caller) ──
  const confirmation = await sendEvalConfirmation({
    parentEmail: booking.parentEmail,
    parentFirst: booking.parentName.split(/\s+/)[0],
    childFirst: booking.childFirst,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    location: slot.location,
  });
  if (!confirmation.ok) {
    // The claim landed but the parent never got confirmed — CONDITIONALLY
    // release the slot (only while it still holds OUR bookingId) so they
    // aren't silently holding a time they think failed. If a residual-race
    // winner owns the row by now ("kept_foreign"), their booking stands
    // untouched and their family hears nothing from this request.
    console.error("[eval-book] confirmation failed after claim:", confirmation.error);
    const released = await releaseEvalSlot(slot.id, bookingId);
    if (released === "failed") {
      console.error(
        `[eval-book] release ALSO failed — slot ${slot.id} (booking ${bookingId}) left Booked; check the Eval Slots db`,
      );
    } else if (released === "kept_foreign") {
      console.log(
        `[eval-book] release skipped — slot ${slot.id} now holds another booking (ours was ${bookingId}); leaving the row`,
      );
    }
    return NextResponse.json(
      { error: "Couldn't send your confirmation. The time was not booked — please try again." },
      { status: 502 },
    );
  }

  // ── Coach notification (fail-soft; carries slot id + booking id — the
  // reconciliation record for any residual claim race) ──
  await sendCoachNotification({ ...booking, bookingId, slot });

  console.log(
    "[eval-book]",
    JSON.stringify({
      slot: slot.id,
      booking: bookingId,
      date: slot.date,
      crm_updated: confirmation.dryRun ? false : confirmation.crm.updated,
    }),
  );

  // No PII echo — the client already knows what it submitted.
  return NextResponse.json({
    success: true,
    slot: { dateLong: formatLongDate(slot.date), startTime: slot.startTime },
  });
}

// Fresh open slots for the client's re-pick after a 409 (the page itself is
// 5-min ISR; this read skips the cache). Public, non-PII (Open rows carry no
// booking fields). Separate, looser limiter than the booking POST.
const slotsLimiter = createRateLimiter({ limit: 30 });

export async function GET(request: NextRequest) {
  if (slotsLimiter.isRateLimited(getClientIp(request))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const slots = await fetchOpenEvalSlots();
  return NextResponse.json({
    slots: slots.map((s) => ({
      id: s.id,
      date: s.date,
      dateLabel: formatLongDate(s.date),
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location,
    })),
  });
}
