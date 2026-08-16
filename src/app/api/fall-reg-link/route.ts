// Secret-gated entry point for the ONE-SHOT fall registration-link backfill —
// the families who answered IN before send-on-confirm existed. The engine
// (IN filter, per-parent-email folding, throttled Resend loop) lives in
// src/lib/fall-reg-link-run.ts; this route only gates the secret and parses
// the request.
//
// ALWAYS dryRun first. There is no sent-flag, so a repeated live run re-mails
// everyone still marked IN — go live with an explicit `only` list, never bare.
// Ongoing responders are handled by the fall-poll POST route, not by this.

import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { runFallRegLinkOutreach } from "@/lib/fall-reg-link-run";

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

  const result = await runFallRegLinkOutreach({ dryRun, only: body.only });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
