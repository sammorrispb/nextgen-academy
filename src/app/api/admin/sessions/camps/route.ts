import { NextRequest, NextResponse } from "next/server";
import { authorizeSessionOps } from "@/lib/session-ops-auth";
import { getStripe } from "@/lib/stripe";
import { collectPaidCampSessions } from "@/lib/notion-camp-roster";
import { toAdminCampCamper } from "@/lib/admin-camp-roster";
import { CAMPS } from "@/data/camps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin Camps roster for /admin/sessions. Camps are a Stripe read-model (no
// session row), so this pages live paid camp checkouts per slug via the same
// reader the coach roster uses, then projects to the admin shape that DROPS the
// day-of safety fields (allergies/emergency contact). Auth: admin cookie (UI) OR
// Bearer SESSION_OPS_SECRET — the same gate as the refund-capable session ops,
// run BEFORE any Stripe read. Optional ?slug returns a single camp.
export async function GET(req: NextRequest) {
  if (!authorizeSessionOps(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = req.nextUrl.searchParams.get("slug");
  const targets = slug ? CAMPS.filter((c) => c.slug === slug) : CAMPS;

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json(
      { error: "Stripe is not configured", camps: [] },
      { status: 503 },
    );
  }

  // The client renders title/week from its own static CAMPS props and keys on
  // slug, so the response carries only slug + the live roster (+ a soft error
  // flag), not the static camp metadata.
  const camps = await Promise.all(
    targets.map(async (camp) => {
      try {
        const { entries } = await collectPaidCampSessions(camp.slug, stripe);
        const campers = entries.map(toAdminCampCamper);
        return { slug: camp.slug, registered: campers.length, campers };
      } catch {
        // One camp's Stripe read failing shouldn't blank the whole section.
        return { slug: camp.slug, registered: 0, campers: [], error: true as const };
      }
    }),
  );

  return NextResponse.json({ camps });
}
