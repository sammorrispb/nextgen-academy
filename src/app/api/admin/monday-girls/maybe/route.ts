import { NextRequest, NextResponse } from "next/server";
import { isAdminCookieRequest } from "@/lib/session-ops-auth";
import { addMondayGirlsMaybe, dismissMondayGirlsMaybe } from "@/lib/admin-monday-girls-actions";

export const runtime = "nodejs";

// Add or dismiss a Monday Girls "maybe" from /admin/monday-girls. Admin COOKIE
// only. `add` forwards ONLY the named fields — the engine writes an explicit
// property list, so nothing extra a caller sends can reach the roster DB.
export async function POST(req: NextRequest) {
  if (!isAdminCookieRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  if (body.action === "add") {
    const result = await addMondayGirlsMaybe({
      parentName: str(body.parentName),
      childFirstName: str(body.childFirstName),
      parentEmail: str(body.parentEmail),
    });
    if (result.ok) return NextResponse.json(result);
    return NextResponse.json(
      { error: result.message, reason: result.reason },
      { status: result.reason === "invalid" ? 400 : 502 },
    );
  }

  if (body.action === "dismiss") {
    const pageId = str(body.pageId).trim();
    if (!pageId) return NextResponse.json({ error: "pageId is required" }, { status: 400 });
    const result = await dismissMondayGirlsMaybe(pageId);
    if (result.ok) return NextResponse.json(result);
    const status =
      result.reason === "not_found" ? 404 : result.reason === "not_a_maybe" || result.reason === "wrong_database" ? 409 : 502;
    return NextResponse.json({ error: result.message, reason: result.reason }, { status });
  }

  return NextResponse.json({ error: "action must be add or dismiss" }, { status: 400 });
}
