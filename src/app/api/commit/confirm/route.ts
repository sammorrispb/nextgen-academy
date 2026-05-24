import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import { verifyCommitToken } from "@/lib/commit-token";
import {
  createCommit,
  findCommitByEmailChildCrew,
  updateCommit,
} from "@/lib/notion-crew-commits";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import {
  commitConfirmationHtml,
  commitConfirmationText,
} from "@/lib/email/commit-confirmation";

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nextgenpbacademy.com";

interface Body {
  token?: string;
  checkoutSessionId?: string;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const token = body.token?.trim();
  const checkoutSessionId = body.checkoutSessionId?.trim();
  if (!token || !checkoutSessionId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const payload = verifyCommitToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid link" }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ["setup_intent", "setup_intent.payment_method"],
  });
  if (session.mode !== "setup") {
    return NextResponse.json({ error: "Wrong checkout mode" }, { status: 400 });
  }
  if (session.status !== "complete") {
    return NextResponse.json(
      { error: "Card setup didn't complete" },
      { status: 409 },
    );
  }
  // Cross-check: the Checkout Session metadata must agree with the token so a
  // tampered URL can't bind a different parent's card to this commit.
  if (session.metadata?.nga_parent_email !== payload.parentEmail) {
    return NextResponse.json({ error: "Token / session mismatch" }, { status: 400 });
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? "";
  const setupIntent = session.setup_intent;
  const pmIdRaw =
    typeof setupIntent === "object" && setupIntent !== null
      ? setupIntent.payment_method
      : null;
  const paymentMethodId = typeof pmIdRaw === "string" ? pmIdRaw : pmIdRaw?.id ?? "";
  if (!customerId || !paymentMethodId) {
    return NextResponse.json(
      { error: "Missing customer or payment method" },
      { status: 500 },
    );
  }

  // Make this the customer's default for off-session invoices.
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  const cardLast4 = pm.card?.last4 ?? "????";

  const parentName =
    (session.metadata?.nga_parent_name ?? "").trim() || payload.parentEmail;
  const parentPhone = (session.metadata?.nga_parent_phone ?? "").trim();
  const parentFirst = parentName.split(" ")[0] || parentName;

  const existing = await findCommitByEmailChildCrew(
    payload.parentEmail,
    payload.childFirstName,
    payload.crewId,
  );

  let pageId: string | undefined;
  if (existing) {
    await updateCommit(existing.id, { status: "Active", lastError: "" });
    pageId = existing.id;
  } else {
    const result = await createCommit({
      parentName,
      parentEmail: payload.parentEmail,
      parentPhone,
      childFirstName: payload.childFirstName,
      crewId: payload.crewId,
      stripeCustomerId: customerId,
      stripePaymentMethodId: paymentMethodId,
    });
    if (!result.ok) {
      console.error("[commit/confirm] notion create failed:", result.error);
      return NextResponse.json(
        { error: "Could not save your commit. Please contact us." },
        { status: 500 },
      );
    }
    pageId = result.pageId;
  }

  const manageUrl = `${SITE_ORIGIN}/commit/${token}`;

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: FROM_EMAIL,
        to: payload.parentEmail,
        bcc: ADMIN_EMAIL,
        replyTo: ADMIN_EMAIL,
        subject: `${payload.childFirstName} is locked in for 4 weeks`,
        html: commitConfirmationHtml({
          parentFirst,
          childFirst: payload.childFirstName,
          crewDescription: payload.crewId.replace(/\|/g, " · "),
          weeksCommitted: 4,
          cardLast4,
          manageUrl,
        }),
        text: commitConfirmationText({
          parentFirst,
          childFirst: payload.childFirstName,
          crewDescription: payload.crewId.replace(/\|/g, " · "),
          weeksCommitted: 4,
          cardLast4,
          manageUrl,
        }),
      });
    } catch (err) {
      console.error("[commit/confirm] confirmation email failed:", err);
    }
  }

  await ingestToOpenBrain({
    email: payload.parentEmail,
    name: parentName,
    phone: parentPhone || undefined,
    business: "nga",
    source: "nga_crew_commit",
    interest: payload.crewId,
    metadata: {
      child_first_name: payload.childFirstName,
      crew_id: payload.crewId,
      weeks_committed: 4,
      stripe_customer_id: customerId,
      card_last4: cardLast4,
      is_parent: true,
    },
  });

  return NextResponse.json({ success: true, commitPageId: pageId });
}
