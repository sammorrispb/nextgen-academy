// Secret-gated curl/agent entry point for the Fall 2026 season poll blast to
// active families. The whole engine (family folding, quarantine + unsubscribe
// suppression, token minting, throttled Resend loop, counts-only admin QA
// copy) lives in src/lib/fall-poll-run.ts — this route only parses the request
// and gates the secret.
//
// ALWAYS dryRun first. There is no sent-flag column, so a repeated live run
// re-sends; use `only` to retry just the addresses that failed. `linksOnly`
// returns each family's three signed poll links without sending — the
// manual-send escape hatch that keeps the signing secret server-side.

import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { runFallPollOutreach } from "@/lib/fall-poll-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secretEquals(secret, process.env.NGA_ADMIN_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    subject?: string;
    dryRun?: boolean;
    linksOnly?: boolean;
    only?: string[];
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const dryRun =
    req.nextUrl.searchParams.get("dryRun") === "1" || body.dryRun === true;

  const result = await runFallPollOutreach({
    dryRun,
    linksOnly: body.linksOnly,
    subject: body.subject,
    only: body.only,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
