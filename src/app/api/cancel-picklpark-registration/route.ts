import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { cancelPicklParkRegistration } from "@/lib/cancel-picklpark";
import {
  picklParkRefundPolicyFor,
  picklParkProratedRefundCents,
  todayET,
  type PicklParkRefundPolicy,
  type PicklParkCancelReason,
} from "@/lib/picklpark-refund-policy";
import {
  findPicklParkRegByPaymentIntent,
  findPicklParkRegByCheckoutSessionId,
} from "@/lib/notion-picklpark-registrations";

export const runtime = "nodejs";

interface CancelPicklParkBody {
  paymentIntentId?: string;
  checkoutSessionId?: string;
  /** Override the policy outright. Omit to let the policy decide. */
  refund?: PicklParkRefundPolicy;
  /**
   * Who is cancelling. Defaults to a parent withdrawing. Pass "nga_cancelled"
   * when NGA can't deliver the sessions — that prorates the undelivered ones
   * back.
   */
  reason?: PicklParkCancelReason;
  /** Preview the decision without refunding or flipping anything. */
  dryRun?: boolean;
}

// Admin curl path for Pickl Park season refunds — the Pickl Park equivalent of
// /api/cancel-fall-registration. Gated by NGA_ADMIN_SECRET. The refund AMOUNT
// is decided by picklpark-refund-policy.ts unless explicitly overridden, so
// the published policy and the code can't drift.
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secretEquals(secret, process.env.NGA_ADMIN_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CancelPicklParkBody;
  try {
    body = (await req.json()) as CancelPicklParkBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const paymentIntentId = body.paymentIntentId?.trim();
  const checkoutSessionId = body.checkoutSessionId?.trim();
  if (!paymentIntentId && !checkoutSessionId) {
    return NextResponse.json(
      { error: "paymentIntentId or checkoutSessionId is required" },
      { status: 400 },
    );
  }

  const today = todayET();
  const decision =
    body.refund ?? picklParkRefundPolicyFor(today, { reason: body.reason });

  const dryRun =
    body.dryRun === true || req.nextUrl.searchParams.get("dryRun") === "1";
  if (dryRun) {
    const row = paymentIntentId
      ? await findPicklParkRegByPaymentIntent(paymentIntentId)
      : await findPicklParkRegByCheckoutSessionId(checkoutSessionId!);
    return NextResponse.json({
      dryRun: true,
      today,
      decision,
      reason: body.reason ?? "parent_withdrawal",
      wouldRefundUsd:
        decision === "full"
          ? (row?.amountPaidUsd ?? 0)
          : decision === "prorated"
            ? picklParkProratedRefundCents(
                today,
                Math.round((row?.amountPaidUsd ?? 0) * 100),
              ) / 100
            : 0,
      found: Boolean(row),
      // No child PII beyond the first name already on the roster row.
      row: row
        ? {
            pageId: row.pageId,
            childFirstName: row.childFirstName,
            group: row.group,
            status: row.status,
            amountPaidUsd: row.amountPaidUsd,
            registeredOnIso: row.registeredOnIso,
          }
        : null,
    });
  }

  const result = await cancelPicklParkRegistration({
    paymentIntentId,
    checkoutSessionId,
    // Only forward an EXPLICIT operator override — otherwise let the engine
    // apply the policy so the two can't drift.
    refund: body.refund,
    reason: body.reason,
  });

  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 400;
    return NextResponse.json(
      { error: result.message, reason: result.reason },
      { status },
    );
  }

  return NextResponse.json({ ...result, today, decision });
}
