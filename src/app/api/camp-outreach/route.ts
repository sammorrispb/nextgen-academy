// Secret-gated curl/agent entry point for the camp outreach blast. The whole
// engine (CRM query, eligible/ambiguous/off_limits segmentation, throttled
// Resend loop) lives in src/lib/lead-outreach-run.ts, shared byte-for-byte
// with the /coach/ops server action — this route only parses the request and
// gates the secret. Trigger parity (especially: OFF-LIMITS / DD-derived rows
// are never mailable from either path, default = eligible-only) is pinned by
// e2e/invariant-ops-trigger-parity.spec.ts.

import { secretEquals } from "@/lib/secret-compare";
import { NextRequest, NextResponse } from "next/server";
import { runCampOutreach } from "@/lib/lead-outreach-run";

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
    only?: string[];
    includeAmbiguous?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const dryRun =
    req.nextUrl.searchParams.get("dryRun") === "1" || body.dryRun === true;
  // Opt in to the ambiguous bucket (own leads, unverified marketing source, NOT
  // DD-derived). Off by default so the conservative on-policy send stays default.
  const includeAmbiguous =
    req.nextUrl.searchParams.get("includeAmbiguous") === "1" ||
    body.includeAmbiguous === true;

  const result = await runCampOutreach({
    dryRun,
    includeAmbiguous,
    subject: body.subject,
    only: body.only,
  });
  return NextResponse.json(result.body, { status: result.status });
}
