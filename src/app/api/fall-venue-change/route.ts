// Secret-gated entry point for the ONE-SHOT Fall 2026 venue-change notice —
// the families who had already paid when the season moved from Wood MS to
// Walter Johnson HS (2026-08-27). The engine (Confirmed-only filter,
// per-parent-email folding, throttled Resend loop) lives in
// src/lib/fall-venue-change-run.ts; this route only gates the secret and
// parses the request.
//
// ALWAYS dryRun first — the body reports scanned_rows, confirmed_rows and the
// exact recipient list. There is no sent-flag column, so a repeated live run
// re-mails every Confirmed family; retry a partial run with an explicit `only`
// list rather than re-firing the whole thing.

import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { runFallVenueChangeNotice } from "@/lib/fall-venue-change-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secretEquals(secret, process.env.NGA_ADMIN_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { dryRun?: boolean; only?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const dryRun =
    req.nextUrl.searchParams.get("dryRun") === "1" || body.dryRun === true;

  const result = await runFallVenueChangeNotice({ dryRun, only: body.only });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
