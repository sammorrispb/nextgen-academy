import { NextRequest, NextResponse } from "next/server";
import { authorizeSessionOps } from "@/lib/session-ops-auth";
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

// Admin/UI + agent entry point to the camp refund engine. Same engine as the
// `?secret=`-gated curl route (cancel-camp-registration), but gated by
// authorizeSessionOps (admin cookie OR Bearer SESSION_OPS_SECRET) so the
// /admin/sessions Camps panel can cancel a camper. The gate runs BEFORE the
// engine, which moves money.
export async function POST(req: NextRequest) {
  if (!authorizeSessionOps(req)) {
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
    emailSent: result.emailSent,
  });
}
