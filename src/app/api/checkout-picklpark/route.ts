import { NextResponse } from "next/server";
import { PICKLPARK_LEAGUES } from "@/data/picklpark-leagues-2026";

// RETIRED 2026-09-07. NGA sold a $225 Pickl Park Saturday season here (Red &
// Orange 3:00–4:00, Green & Yellow 4:00–5:00). The Pickl Park now sells that
// Saturday itself as two podplay leagues, so this site takes no payment for
// it — see src/data/picklpark-leagues-2026.ts.
//
// 410 Gone, not 503: 503 means "try later", and this is never coming back at
// this URL. The body carries the podplay links so anything still POSTing here
// (a cached form, a bookmarked script) can route a family to the real
// checkout instead of dead-ending them.
//
// No Stripe import, no price env var, no Notion seat count. Deleting the
// branch rather than flag-gating it is the point: no env var can reopen a
// charge whose code is gone. The unused season/registration/refund modules
// stay on disk for the historical rows and come out in a separate cleanup.

const RETIRED_MESSAGE =
  "The Pickl Park Saturday season is no longer sold by Next Gen Pickleball Academy — The Pickl Park registers both leagues directly.";

export async function POST() {
  return NextResponse.json(
    {
      error: RETIRED_MESSAGE,
      leagues: PICKLPARK_LEAGUES.map((l) => ({
        title: l.title,
        time: l.timeLabel,
        ages: l.ageLabel,
        signupUrl: l.signupUrl,
      })),
    },
    { status: 410 },
  );
}

export async function GET() {
  return NextResponse.json({ error: RETIRED_MESSAGE }, { status: 410 });
}
