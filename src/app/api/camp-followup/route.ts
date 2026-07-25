// Secret-gated curl/agent entry point for the camp conclusion follow-up
// (Google-review ask + share blurb + next-camp register link). The whole
// engine lives in src/lib/camp-followup-run.ts — this route only parses the
// request and gates the secret, mirroring /api/camp-outreach. Always dryRun
// first: there's no sent-flag column, so a repeated live run re-sends.

import { secretEquals } from "@/lib/secret-compare";
import { NextRequest, NextResponse } from "next/server";
import { runCampFollowup } from "@/lib/camp-followup-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secretEquals(secret, process.env.NGA_ADMIN_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    slug?: string;
    dryRun?: boolean;
    only?: string[];
    reviewUrl?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const dryRun =
    req.nextUrl.searchParams.get("dryRun") === "1" || body.dryRun === true;

  const result = await runCampFollowup({
    slug: body.slug,
    dryRun,
    only: body.only,
    reviewUrl: body.reviewUrl,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: 503 });
  }
  return NextResponse.json(result);
}
