import { NextResponse } from "next/server";
import { fetchUpcomingSessions } from "@/lib/notion-sessions";
import { buildSessionsFeed } from "@/lib/sessions-feed";

// Public, read-only feed of upcoming NGA drop-in sessions for cross-brand
// surfaces (the Link & Dink combined schedule at www.linkanddink.com/schedule).
// Aggregate counts + session metadata only — NO child PII (see sessions-feed.ts
// + invariant-sessions-feed-pii-egress.spec.ts). CDN-cached to match the 5-min
// ISR on the public /schedule page.
export const revalidate = 300;

export async function GET() {
  const sessions = await fetchUpcomingSessions();
  const items = buildSessionsFeed(sessions);

  return NextResponse.json(
    {
      _meta: {
        source: "nga_sessions",
        count: items.length,
      },
      sessions: items,
    },
    {
      headers: {
        // Public non-PII feed — readable cross-origin by the L&D schedule page.
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
