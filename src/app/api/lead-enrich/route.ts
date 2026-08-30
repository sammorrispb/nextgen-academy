import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { runLeadEnrich, type LeadEnrichInput } from "@/lib/lead-enrich-run";

/**
 * Agent-callable email → CRM enrichment.
 *
 * `Authorization: Bearer LEAD_ENRICH_SECRET`. Fails CLOSED: a wrong token OR an
 * unset secret both 401, so the surface ships dark until deliberately enabled.
 * The secret is dedicated (not NGA_ADMIN_SECRET) to isolate blast radius, the
 * same reason ATTENDANCE_SECRET and SESSION_OPS_SECRET are their own.
 *
 * Always call with {"dryRun": true} first — it returns the exact Notes line
 * that would be appended and writes nothing.
 */
function authorizeLeadEnrich(req: NextRequest): boolean {
  const expected = process.env.LEAD_ENRICH_SECRET;
  return secretEquals(
    req.headers.get("authorization"),
    expected ? `Bearer ${expected}` : undefined,
  );
}

export async function POST(request: NextRequest) {
  if (!authorizeLeadEnrich(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: LeadEnrichInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await runLeadEnrich(body);
  return NextResponse.json(result.body, { status: result.status });
}
