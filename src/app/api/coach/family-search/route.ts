import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/coach-auth-server";
import { fetchAllDropInsInRange } from "@/lib/notion-dropins";
import { buildFamilyDirectory, toSearchIndex } from "@/lib/player-profiles";

export const dynamic = "force-dynamic";

// Lightweight, coach-scoped search index for the top-nav family search. Returns
// parent + child NAMES + the profile key only (never email/phone/birth year —
// see toSearchIndex). Fails CLOSED: no valid coach session → 401 with zero
// Notion egress, so child names never leave without coach auth. The gate
// composition itself is pinned by invariant-coach-session-scope.spec.ts.
export async function GET() {
  // requireCoach reads the signed cookie via next/headers; outside a request
  // scope (or with a bad/absent cookie) it yields null → we fail closed.
  const coach = await requireCoach().catch(() => null);
  if (!coach) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 365);
  const to = new Date(now);
  to.setDate(to.getDate() + 60);

  const rows = await fetchAllDropInsInRange(
    from.toISOString().slice(0, 10),
    to.toISOString().slice(0, 10),
  );
  const families = toSearchIndex(buildFamilyDirectory(rows));
  return NextResponse.json({ families });
}
