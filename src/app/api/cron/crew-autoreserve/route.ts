import { secretEquals } from "@/lib/secret-compare";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import { crewChargeIdempotencyKey } from "@/lib/crew-charge";
import {
  fetchActiveCommits,
  updateCommit,
  type CrewCommit,
} from "@/lib/notion-crew-commits";
import {
  fetchUpcomingSessions,
  incrementSessionRegistered,
  type NgaSession,
} from "@/lib/notion-sessions";
import {
  createDropInRegistration,
  fetchUpcomingDropIns,
} from "@/lib/notion-dropins";
import { buildCrewId, signCommitToken } from "@/lib/commit-token";
import { signCancelToken } from "@/lib/cancel-token";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import {
  commitChargeReceiptHtml,
  commitChargeReceiptText,
} from "@/lib/email/commit-charge-receipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";
const CHARGE_AMOUNT_CENTS = 2000;
const LOOKAHEAD_DAYS = 8;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatLongDate(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface PerCommitOutcome {
  commitId: string;
  parentEmail: string;
  childFirst: string;
  action: "reserved" | "no-match" | "already-on-roster" | "card-failed" | "completed" | "error";
  sessionDate?: string;
  amountUsd?: number;
  error?: string;
}

function findNextMatchingSession(
  commit: CrewCommit,
  sessions: NgaSession[],
): NgaSession | null {
  for (const s of sessions) {
    if (s.status !== "Open") continue;
    if (s.spotsLeft <= 0) continue;
    const sCrewId = buildCrewId({
      level: s.level ?? "",
      date: s.date,
      startTime: s.startTime,
      location: s.location,
    });
    if (sCrewId === commit.crewId) return s;
  }
  return null;
}

async function processOne(
  resend: Resend | null,
  commit: CrewCommit,
  sessions: NgaSession[],
  upcomingDrops: Awaited<ReturnType<typeof fetchUpcomingDropIns>>,
): Promise<PerCommitOutcome> {
  const outcome: PerCommitOutcome = {
    commitId: commit.id,
    parentEmail: commit.parentEmail,
    childFirst: commit.childFirstName,
    action: "no-match",
  };

  if (commit.weeksReserved >= commit.weeksCommitted) {
    await updateCommit(commit.id, { status: "Completed" });
    outcome.action = "completed";
    return outcome;
  }

  const next = findNextMatchingSession(commit, sessions);
  if (!next) return outcome;

  // Idempotency: don't double-book if this child is already on the roster.
  const already = upcomingDrops.some(
    (d) =>
      d.sessionDate === next.date &&
      d.sessionTitle === next.title &&
      d.parentEmail.toLowerCase() === commit.parentEmail.toLowerCase() &&
      d.childFirstName.toLowerCase() === commit.childFirstName.toLowerCase(),
  );
  if (already) {
    outcome.action = "already-on-roster";
    outcome.sessionDate = next.date;
    return outcome;
  }

  const stripe = getStripe();

  // Off-session charge. SCA-required cards will throw with code
  // authentication_required — we flip the commit to CardFailed so the
  // parent's manage page surfaces it.
  let paymentIntentId = "";
  try {
    const pi = await stripe.paymentIntents.create({
      amount: CHARGE_AMOUNT_CENTS,
      currency: "usd",
      customer: commit.stripeCustomerId,
      payment_method: commit.stripePaymentMethodId,
      off_session: true,
      confirm: true,
      description: `NGA crew reservation — ${commit.childFirstName} — ${next.title}`,
      metadata: {
        nga_commit_id: commit.id,
        nga_crew_id: commit.crewId,
        nga_session_id: next.id,
        nga_child_first_name: commit.childFirstName,
      },
    },
    // Deterministic per (commit, session) so a same-day cron re-run dedupes at
    // Stripe instead of double-charging past the eventually-consistent roster guard.
    { idempotencyKey: crewChargeIdempotencyKey(commit.id, next.id) },
    );
    paymentIntentId = pi.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateCommit(commit.id, {
      status: "CardFailed",
      lastError: message,
    });
    if (resend) {
      const recoverUrl = `${SITE_ORIGIN}/commit/${signCommitToken({
        parentEmail: commit.parentEmail,
        childFirstName: commit.childFirstName,
        crewId: commit.crewId,
      })}`;
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: commit.parentEmail,
          bcc: ADMIN_EMAIL,
          subject: `Card declined for ${commit.childFirstName}'s next session — quick fix`,
          html: `<p>Hi,</p><p>Your card couldn't be charged for ${escape(commit.childFirstName)}'s upcoming session. Update your card here to keep the crew spot: <a href="${recoverUrl}">${recoverUrl}</a></p><p>Coach Sam · Next Gen Pickleball Academy</p>`,
          text: `Hi,\n\nYour card couldn't be charged for ${commit.childFirstName}'s upcoming session. Update your card to keep the crew spot: ${recoverUrl}\n\nCoach Sam · Next Gen Pickleball Academy`,
        });
      } catch (mailErr) {
        console.error("[cron/crew-autoreserve] card-failed email failed", mailErr);
      }
    }
    outcome.action = "card-failed";
    outcome.error = message;
    return outcome;
  }

  // Synthesize a unique "checkout session id" for the drop-in row even though
  // we charged off-session via PaymentIntent. This keeps the existing cancel
  // path (/api/cancel-registration looks up by Stripe Checkout Session ID)
  // working when a parent wants to skip a week — we just store the PI id in
  // its place. The cancel flow uses it to retrieve and refund the PI.
  const checkoutSessionId = paymentIntentId;

  // The roster row is the source of truth (roster, reminders, check-in, cancel
  // refunds). We've ALREADY charged the card, so a failed create can't be
  // swallowed the way it used to be — that left a parent paid with no
  // reservation. Retry a few times to ride out a transient Notion blip; if it
  // still fails, refund the charge and pull the commit from the auto-charge
  // loop (next run keys idempotency off the roster row, which wouldn't exist —
  // so leaving it Active would double-charge).
  let rowCreated = false;
  for (let attempt = 1; attempt <= 3 && !rowCreated; attempt++) {
    rowCreated = await createDropInRegistration({
      parentName: commit.parentName,
      parentEmail: commit.parentEmail,
      parentPhone: commit.parentPhone,
      childFirstName: commit.childFirstName,
      childBirthYear: 0,
      sessionTitle: next.title,
      sessionDate: next.date,
      sessionStartTime: next.startTime,
      location: next.location,
      publicArea: next.publicArea,
      locationHidden: false, // hidden-location retired 2026-06-05 — venues are public
      level: next.level,
      amountPaidUsd: CHARGE_AMOUNT_CENTS / 100,
      stripeCheckoutSessionId: checkoutSessionId,
      stripePaymentIntentId: paymentIntentId,
      displayConsent: false,
      smsConsent: false,
      smsConsentText: "",
    });
    if (!rowCreated && attempt < 3) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }

  if (!rowCreated) {
    let refunded = false;
    try {
      await stripe.refunds.create({ payment_intent: paymentIntentId });
      refunded = true;
    } catch (refundErr) {
      console.error(
        "[cron/crew-autoreserve] refund after row-create failure failed",
        refundErr,
      );
    }
    await updateCommit(commit.id, {
      status: "CardFailed",
      lastError: refunded
        ? "Roster row create failed after charge; charge refunded. Set back to Active to rebook."
        : "Roster row create failed AND refund failed — parent charged with no reservation. Fix in Stripe + Notion.",
    });
    if (resend) {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: ADMIN_EMAIL,
          subject: `[crew-autoreserve] roster row failed for ${commit.childFirstName} — ${refunded ? "refunded" : "REFUND FAILED"}`,
          text:
            `Auto-reserve charged the card but the Notion roster row didn't save after 3 tries.\n\n` +
            `Commit: ${commit.id}\n` +
            `Parent: ${commit.parentName} <${commit.parentEmail}>\n` +
            `Child: ${commit.childFirstName}\n` +
            `Session: ${next.title} — ${next.date} ${next.startTime}\n` +
            `PaymentIntent: ${paymentIntentId}\n\n` +
            (refunded
              ? `The charge was refunded and the commit set to CardFailed. Flip it back to Active to retry the booking.`
              : `REFUND ALSO FAILED — the parent is charged with no reservation. Refund the PaymentIntent in Stripe and create the roster row manually.`),
        });
      } catch (mailErr) {
        console.error(
          "[cron/crew-autoreserve] row-failure admin alert failed",
          mailErr,
        );
      }
    }
    outcome.action = "error";
    outcome.error = "row-create-failed";
    outcome.sessionDate = next.date;
    return outcome;
  }

  await incrementSessionRegistered(next.id, 1);

  const newWeeks = commit.weeksReserved + 1;
  await updateCommit(commit.id, {
    weeksReserved: newWeeks,
    lastChargeAtIso: isoDate(new Date()),
    lastError: "",
    status: newWeeks >= commit.weeksCommitted ? "Completed" : "Active",
  });

  if (resend) {
    const pm = await stripe.paymentMethods
      .retrieve(commit.stripePaymentMethodId)
      .catch(() => null);
    const cardLast4 = pm?.card?.last4 ?? "????";
    const cancelToken = signCancelToken(checkoutSessionId);
    const cancelUrl = cancelToken
      ? `${SITE_ORIGIN}/schedule/cancel?token=${cancelToken}`
      : `${SITE_ORIGIN}/schedule/cancel`;
    const manageUrl = `${SITE_ORIGIN}/commit/${signCommitToken({
      parentEmail: commit.parentEmail,
      childFirstName: commit.childFirstName,
      crewId: commit.crewId,
    })}`;
    const parentFirst = commit.parentName.split(" ")[0] || commit.parentName;
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: commit.parentEmail,
        bcc: ADMIN_EMAIL,
        replyTo: ADMIN_EMAIL,
        subject: `${commit.childFirstName}'s spot is reserved — ${formatLongDate(next.date)}`,
        html: commitChargeReceiptHtml({
          parentFirst,
          childFirst: commit.childFirstName,
          sessionTitle: next.title,
          sessionDateLong: formatLongDate(next.date),
          sessionStartTime: next.startTime,
          location: next.location,
          amountUsd: CHARGE_AMOUNT_CENTS / 100,
          weeksReservedSoFar: newWeeks,
          weeksCommitted: commit.weeksCommitted,
          cardLast4,
          cancelUrl,
          manageUrl,
        }),
        text: commitChargeReceiptText({
          parentFirst,
          childFirst: commit.childFirstName,
          sessionTitle: next.title,
          sessionDateLong: formatLongDate(next.date),
          sessionStartTime: next.startTime,
          location: next.location,
          amountUsd: CHARGE_AMOUNT_CENTS / 100,
          weeksReservedSoFar: newWeeks,
          weeksCommitted: commit.weeksCommitted,
          cardLast4,
          cancelUrl,
          manageUrl,
        }),
      });
    } catch (err) {
      console.error("[cron/crew-autoreserve] receipt email failed", err);
    }
  }

  void ingestToOpenBrain({
    business: "nga",
    source: "nga_crew_autoreserve",
    email: commit.parentEmail,
    name: commit.parentName || undefined,
    phone: commit.parentPhone || undefined,
    interest: commit.childFirstName,
    metadata: {
      child_first_name: commit.childFirstName,
      session_title: next.title,
      session_date: next.date,
      session_start_time: next.startTime,
      location: next.location,
      crew_id: commit.crewId,
      week_of: newWeeks,
      weeks_committed: commit.weeksCommitted,
      payment_intent_id: paymentIntentId,
    },
  });

  outcome.action = "reserved";
  outcome.sessionDate = next.date;
  outcome.amountUsd = CHARGE_AMOUNT_CENTS / 100;
  return outcome;
}

export async function GET(req: NextRequest) {
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

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + LOOKAHEAD_DAYS);

  const [commits, sessions, drops] = await Promise.all([
    fetchActiveCommits(),
    fetchUpcomingSessions(now),
    fetchUpcomingDropIns(isoDate(now), isoDate(end)),
  ]);

  const resendApiKey = process.env.RESEND_API_KEY;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;

  const outcomes: PerCommitOutcome[] = [];
  for (const c of commits) {
    try {
      outcomes.push(await processOne(resend, c, sessions, drops));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[cron/crew-autoreserve] processOne threw", c.id, message);
      outcomes.push({
        commitId: c.id,
        parentEmail: c.parentEmail,
        childFirst: c.childFirstName,
        action: "error",
        error: message,
      });
    }
  }

  const summary = {
    active_commits: commits.length,
    reserved: outcomes.filter((o) => o.action === "reserved").length,
    already_on_roster: outcomes.filter((o) => o.action === "already-on-roster").length,
    no_match: outcomes.filter((o) => o.action === "no-match").length,
    card_failed: outcomes.filter((o) => o.action === "card-failed").length,
    completed: outcomes.filter((o) => o.action === "completed").length,
    errors: outcomes.filter((o) => o.action === "error").length,
  };
  console.log("[cron/crew-autoreserve]", JSON.stringify(summary));

  return NextResponse.json({ ok: true, ...summary, outcomes });
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
