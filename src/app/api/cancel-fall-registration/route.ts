import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { cancelFallRegistration } from "@/lib/cancel-fall";
import {
  fallRefundPolicyFor,
  fallProratedRefundCents,
  todayET,
  type FallRefundPolicy,
  type FallCancelReason,
} from "@/lib/fall-refund-policy";
import { findFallRegByPaymentIntent, findFallRegByCheckoutSessionId } from "@/lib/notion-fall-registrations";

export const runtime = "nodejs";

interface CancelFallBody {
  paymentIntentId?: string;
  checkoutSessionId?: string;
  /** Override the policy outright. Omit to let the policy decide. */
  refund?: FallRefundPolicy;
  /**
   * Who is cancelling. Defaults to a parent withdrawing. Pass "nga_cancelled"
   * when NGA can't deliver the sessions — that prorates the undelivered ones
   * back regardless of the terms the family registered under.
   */
  reason?: FallCancelReason;
  /** Preview the decision without refunding or flipping anything. */
  dryRun?: boolean;
}

// Admin curl path for fall season refunds — the fall equivalent of
// /api/cancel-registration (drop-ins) and /api/cancel-camp-registration (camps).
// Gated by NGA_ADMIN_SECRET. The refund AMOUNT is decided by
// fall-refund-policy.ts unless explicitly overridden, so the published policy
// and the code can't drift.
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secretEquals(secret, process.env.NGA_ADMIN_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CancelFallBody;
  try {
    body = (await req.json()) as CancelFallBody;
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

  // The decision needs the row: the no-refund cutoff keys off WHEN the family
  // registered, so previewing without the row would show the wrong answer for
  // exactly the families whose terms differ.
  const row = paymentIntentId
    ? await findFallRegByPaymentIntent(paymentIntentId)
    : await findFallRegByCheckoutSessionId(checkoutSessionId!);

  const decision =
    body.refund ??
    fallRefundPolicyFor(today, {
      registeredOnIso: row?.registeredOnIso || undefined,
      reason: body.reason,
    });

  const dryRun = body.dryRun === true || req.nextUrl.searchParams.get("dryRun") === "1";
  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      today,
      decision,
      reason: body.reason ?? "parent_withdrawal",
      wouldRefundUsd:
        decision === "full"
          ? (row?.amountPaidUsd ?? 0)
          : decision === "prorated"
            ? fallProratedRefundCents(
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

  const result = await cancelFallRegistration({
    paymentIntentId,
    checkoutSessionId,
    // Only forward an EXPLICIT operator override — otherwise let the engine
    // apply the policy against the row it looks up, so the two can't drift.
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
