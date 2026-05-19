import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  findDropInPageByCheckoutId,
  updateDropInStatus,
} from "@/lib/notion-dropins";
import {
  decrementSessionRegistered,
  findSessionIdByDateAndTime,
} from "@/lib/notion-sessions";
import { sessionToSlug } from "@/lib/session-slug";

export const runtime = "nodejs";

interface CancelBody {
  checkoutSessionId?: string;
  /** "Cancelled" for a no-refund removal, "Refunded" if a refund was issued. */
  status?: "Cancelled" | "Refunded";
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const expected = process.env.NGA_ADMIN_SECRET;
  if (!expected || secret !== expected) {
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

  const dropIn = await findDropInPageByCheckoutId(checkoutSessionId);
  if (!dropIn) {
    return NextResponse.json(
      { error: "Drop-in not found" },
      { status: 404 },
    );
  }

  // Idempotent: if already in target state, nothing to do.
  if (dropIn.status === newStatus) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  // Refunding/cancelling something that was never Confirmed shouldn't decrement.
  const shouldDecrement = dropIn.status === "Confirmed";

  const statusOk = await updateDropInStatus(dropIn.id, newStatus);
  if (!statusOk) {
    return NextResponse.json(
      { error: "Failed to update drop-in status" },
      { status: 500 },
    );
  }

  if (shouldDecrement) {
    const sessionId = await findSessionIdByDateAndTime(
      dropIn.sessionDate,
      dropIn.sessionStartTime,
    );
    if (sessionId) {
      await decrementSessionRegistered(sessionId, 1);
    }
  }

  revalidatePath("/schedule");
  if (dropIn.sessionTitle && dropIn.sessionDate) {
    const slug = sessionToSlug({
      title: dropIn.sessionTitle,
      date: dropIn.sessionDate,
    });
    if (slug) revalidatePath(`/schedule/${slug}`);
  }

  return NextResponse.json({
    ok: true,
    pageId: dropIn.id,
    status: newStatus,
    decremented: shouldDecrement,
  });
}
