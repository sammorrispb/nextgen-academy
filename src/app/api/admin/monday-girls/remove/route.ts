import { NextRequest, NextResponse } from "next/server";
import { isAdminCookieRequest } from "@/lib/session-ops-auth";
import { removeMondayGirlsPlayer, type RemoveMode } from "@/lib/admin-monday-girls-actions";

export const runtime = "nodejs";

const MODES: readonly RemoveMode[] = ["already_refunded", "none"];

// Anything not listed is a refusal about the row's state → 409.
const STATUS_BY_REASON: Record<string, number> = {
  not_found: 404,
  config_missing: 503,
  query_failed: 502,
  stripe_failed: 502,
  update_failed: 502,
};

// Record a Monday Girls removal from /admin/monday-girls. Admin COOKIE only —
// there is no agent caller, so the Bearer ops secret deliberately can't open it.
// The body is an exact allowlist: an unknown mode is a 400, never a default,
// because a typo'd default on a roster write is how a family gets mislabelled.
// This route never refunds; see src/lib/admin-monday-girls-actions.ts.
export async function POST(req: NextRequest) {
  if (!isAdminCookieRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { pageId?: unknown; mode?: unknown; notifyParent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";
  const mode = MODES.find((m) => m === body.mode);
  if (!pageId || !mode || typeof body.notifyParent !== "boolean") {
    return NextResponse.json(
      { error: "pageId, mode (already_refunded | none) and notifyParent (boolean) are required" },
      { status: 400 },
    );
  }

  const result = await removeMondayGirlsPlayer({ pageId, mode, notifyParent: body.notifyParent });
  if (!result.ok) {
    const status = STATUS_BY_REASON[result.reason] ?? 409;
    return NextResponse.json({ error: result.message, reason: result.reason }, { status });
  }
  return NextResponse.json(result);
}
