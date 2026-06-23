import { secretEquals } from "@/lib/secret-compare";
import { NextRequest, NextResponse } from "next/server";
import { runCampReminder } from "@/lib/camp-reminder-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Friday-before-camp reminder. Vercel cron fires every Friday (0 13 * * 5 UTC,
 * ~9am ET); it no-ops on Fridays with no camp the following Monday. Auth =
 * Bearer CRON_SECRET (Vercel injects it; a manual curl needs the same header).
 *
 * Query params (manual runs):
 *   ?dryRun=1        preview recipients + a rendered sample, no send, no writes
 *   ?slug=june-29    target a specific camp instead of the auto Friday→Monday one
 *   ?only=a@b,c@d    restrict the live send to these parent emails (retry failures)
 *
 * Always dry-run first to eyeball the recipient list + copy before a live send
 * (paying-family / child-PII comms — see LSN-014 + Minor-Data Governance).
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!secretEquals(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const dryRun = params.get("dryRun") === "1";
  const slug = params.get("slug") ?? undefined;
  const only = params
    .get("only")
    ?.split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  try {
    const result = await runCampReminder({ slug, dryRun, only });
    const status = result.ok ? 200 : 500;
    return NextResponse.json(result, { status });
  } catch (err) {
    console.error("[camp-reminder] run threw", err);
    return NextResponse.json(
      { ok: false, error: "camp reminder run failed" },
      { status: 500 },
    );
  }
}
