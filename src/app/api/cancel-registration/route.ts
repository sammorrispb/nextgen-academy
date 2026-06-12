import { secretEquals } from "@/lib/secret-compare";
import { NextRequest, NextResponse } from "next/server";
import { cancelDropIn } from "@/lib/cancel-dropin";

export const runtime = "nodejs";

interface CancelBody {
  checkoutSessionId?: string;
  /** "Cancelled" for a no-refund removal, "Refunded" if a refund was issued. */
  status?: "Cancelled" | "Refunded";
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const expected = process.env.NGA_ADMIN_SECRET;
  if (!secretEquals(secret, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CancelBody;
  try {
    body = (await req.json()) as CancelBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const checkoutSessionId = body.checkoutSessionId?.trim();
  if (!checkoutSessionId) {
    return NextResponse.json(
      { error: "checkoutSessionId is required" },
      { status: 400 },
    );
  }

  const newStatus = body.status === "Refunded" ? "Refunded" : "Cancelled";
  const result = await cancelDropIn(checkoutSessionId, newStatus);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason === "not_found" ? "Drop-in not found" : "Failed to update" },
      { status: result.reason === "not_found" ? 404 : 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    pageId: result.pageId,
    status: newStatus,
    decremented: result.decremented,
    idempotent: result.idempotent ?? false,
  });
}
