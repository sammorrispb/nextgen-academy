// Secret-gated curl/agent entry point for the eval re-engagement blast. The
// whole engine (CRM query, DD-clean segmentation, throttled Resend loop) lives
// in src/lib/lead-outreach-run.ts, shared byte-for-byte with the /coach/ops
// server action — this route only parses the request and gates the secret.
// Trigger parity is pinned by e2e/invariant-ops-trigger-parity.spec.ts.

import { secretEquals } from "@/lib/secret-compare";
import { NextRequest, NextResponse } from "next/server";
import { runEvalReengagement } from "@/lib/lead-outreach-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secretEquals(secret, process.env.NGA_ADMIN_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { subject?: string; dryRun?: boolean; only?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const dryRun =
    req.nextUrl.searchParams.get("dryRun") === "1" || body.dryRun === true;

  const result = await runEvalReengagement({
    dryRun,
    subject: body.subject,
    only: body.only,
  });
  return NextResponse.json(result.body, { status: result.status });
}
