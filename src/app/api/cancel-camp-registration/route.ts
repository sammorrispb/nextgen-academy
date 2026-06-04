import { NextRequest, NextResponse } from "next/server";
import { cancelCampRegistration } from "@/lib/cancel-camp";
import type { RefundOption } from "@/lib/refund-amount";

export const runtime = "nodejs";

interface CancelCampBody {
  checkoutSessionId?: string;
  parentEmail?: string;
  /** "none" | "full" | "partial". Defaults to "full". */
  refund?: RefundOption;
  /** Required when refund === "partial". Amount to return, in cents. */
  amountCents?: number;
}

// Admin curl path for camp refunds — the camp equivalent of
// /api/cancel-registration (which only handles $20 drop-ins). Camps carry no
// Notion roster, so this keys off the Stripe Checkout Session (or parent email)
// and deregisters via the Player CRM + Open Brain. Gated by NGA_ADMIN_SECRET.
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const expected = process.env.NGA_ADMIN_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CancelCampBody;
  try {
    body = (await req.json()) as CancelCampBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const checkoutSessionId = body.checkoutSessionId?.trim();
  const parentEmail = body.parentEmail?.trim();
  if (!checkoutSessionId && !parentEmail) {
    return NextResponse.json(
      { error: "checkoutSessionId or parentEmail is required" },
      { status: 400 },
    );
  }

  const refund: RefundOption =
    body.refund === "none" || body.refund === "partial" ? body.refund : "full";

  const result = await cancelCampRegistration({
    checkoutSessionId,
    parentEmail,
    refund,
    amountCents: body.amountCents,
  });

  if (!result.ok) {
    const status =
      result.reason === "not_found" || result.reason === "not_camp" ? 404 : 400;
    return NextResponse.json({ error: result.message, reason: result.reason }, { status });
  }

  return NextResponse.json({
    ok: true,
    checkoutSessionId: result.checkoutSessionId,
    refundedUsd: result.refundedUsd,
    playerUpdated: result.playerUpdated,
    emailSent: result.emailSent,
  });
}
