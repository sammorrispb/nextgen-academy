import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { verifyCommitToken } from "@/lib/commit-token";

interface Body {
  token?: string;
  parentName?: string;
  parentPhone?: string;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const payload = verifyCommitToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const stripe = getStripe();

  // Reuse an existing customer keyed on email so a parent who already has a
  // Stripe Customer (from prior $40 drop-in checkouts) doesn't get a duplicate.
  const existing = await stripe.customers.list({
    email: payload.parentEmail,
    limit: 1,
  });
  const customer =
    existing.data[0] ??
    (await stripe.customers.create({
      email: payload.parentEmail,
      metadata: {
        nga_child_first_name: payload.childFirstName,
        nga_crew_id: payload.crewId,
      },
    }));

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://nextgenpbacademy.com";

  const checkout = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customer.id,
    payment_method_types: ["card"],
    metadata: {
      nga_parent_email: payload.parentEmail,
      nga_child_first_name: payload.childFirstName,
      nga_crew_id: payload.crewId,
      nga_parent_name: body.parentName?.trim() ?? "",
      nga_parent_phone: body.parentPhone?.trim() ?? "",
    },
    success_url: `${origin}/commit/${token}/success?cs={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/commit/${token}`,
  });

  return NextResponse.json({ url: checkout.url });
}
