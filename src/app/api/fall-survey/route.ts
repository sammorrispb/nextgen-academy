// Secret-gated curl/agent entry point for the Fall 2026 season-feedback blast.
// The whole engine (audience union, DD-clean segmentation, throttled Resend
// loop, counts-only admin QA copy) lives in src/lib/fall-survey-run.ts, shared
// with the /coach/ops server action — this route only parses the request and
// gates the secret.
//
// ALWAYS dryRun first. There is no sent-flag column, so a repeated live run
// re-sends; use `only` to retry just the addresses that failed.

import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { runFallSurvey } from "@/lib/fall-survey-run";
import type { FallSurveyVariant } from "@/lib/email/fall-survey";

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
    variant?: FallSurveyVariant;
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const dryRun =
    req.nextUrl.searchParams.get("dryRun") === "1" || body.dryRun === true;

  const result = await runFallSurvey({
    dryRun,
    subject: body.subject,
    only: body.only,
    variant: body.variant,
  });

  // A refusal is a 503 (misconfiguration / bad input), never a silent 200 —
  // mirrors the camp-followup route's mapping.
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
