// Secret-gated curl/agent entry point for the post-eval follow-up. The whole
// engine (player fetch, live session lines, branded email to the PARENT, CRM
// Level/Status/Next-Action stamp) lives in src/lib/post-eval-followup-run.ts,
// shared byte-for-byte with the /coach/ops server action — this route only
// parses the request and gates the secret. `?dryRun=1` (additive) previews the
// recipient + rendered email without sending or writing. Trigger parity is
// pinned by e2e/invariant-ops-trigger-parity.spec.ts.

import { secretEquals } from "@/lib/secret-compare";
import { NextRequest, NextResponse } from "next/server";
import {
  runPostEvalFollowup,
  type PostEvalBody,
} from "@/lib/post-eval-followup-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const expected = process.env.NGA_ADMIN_SECRET;
  if (!secretEquals(secret, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";

  let body: PostEvalBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await runPostEvalFollowup(body, { dryRun });
  return NextResponse.json(result.body, { status: result.status });
}
