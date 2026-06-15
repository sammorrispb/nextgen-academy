import { secretEquals } from "@/lib/secret-compare";
import { NextRequest, NextResponse } from "next/server";
import { confirmCrew } from "@/lib/crew-confirm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Agent-callable crew confirmation — the secret-gated twin of the coach
 * dashboard's `confirmCrewAction`. Both funnel through `confirmCrew()`, so a
 * back-office agent hitting this endpoint fires the IDENTICAL fan-out a coach
 * gets from the ConfirmCrewForm button (per-parent crew-confirmed email + poll
 * Status → "Confirmed") instead of writing the Notion Status directly and
 * silently dropping the parent emails.
 *
 * Gated by `Authorization: Bearer CREW_CONFIRM_SECRET` (constant-time compare,
 * fails CLOSED). The secret is dedicated — NOT NGA_ADMIN_SECRET — so this
 * minor-PII fan-out can't ride the mega-secret's blast radius, and it travels in
 * a header rather than the query string (no access-log exposure).
 *
 * Body (JSON): `{ pollSlug, selectedResponseIds, firstSessionDate }`. The ack is
 * PII-free (counts + status only, never a parent/child name or email). Unlike
 * the action, the route does NOT revalidate — there's no coach session/page to
 * refresh; the coach view picks up the flip on its next ISR.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.CREW_CONFIRM_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!expected || !secretEquals(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    pollSlug?: string;
    selectedResponseIds?: string[];
    firstSessionDate?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.pollSlug?.trim()) {
    return NextResponse.json({ error: "Missing pollSlug" }, { status: 400 });
  }
  if (
    !Array.isArray(body.selectedResponseIds) ||
    body.selectedResponseIds.length === 0
  ) {
    return NextResponse.json(
      { error: "selectedResponseIds must be a non-empty array" },
      { status: 400 },
    );
  }
  if (!body.firstSessionDate?.trim()) {
    return NextResponse.json(
      { error: "Missing firstSessionDate" },
      { status: 400 },
    );
  }

  const result = await confirmCrew({
    pollSlug: body.pollSlug,
    selectedResponseIds: body.selectedResponseIds,
    firstSessionDate: body.firstSessionDate,
  });

  // Already Confirmed/Cancelled → idempotent no-op (no email, no write).
  if (result.idempotent) {
    return NextResponse.json({ ok: true, idempotent: true, emailsSent: 0 });
  }

  if (!result.ok) {
    const status = result.message === "Poll not found"
      ? 404
      : result.message.startsWith("Emailed")
        ? 500 // emails sent but Status flip failed — surface so caller can retry
        : 400;
    return NextResponse.json({ error: result.message }, { status });
  }

  // PII-free ack — counts only, never child/parent fields.
  return NextResponse.json({
    ok: true,
    emailsSent: result.emailsSent ?? 0,
    idempotent: false,
  });
}
