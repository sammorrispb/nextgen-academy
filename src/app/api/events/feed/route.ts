import { NextResponse } from "next/server";
import { fetchUpcomingSessions } from "@/lib/notion-sessions";
import { buildEventsFeed } from "@/lib/events-feed";

// Public, read-only feed of EVERY dated NGA thing — drop-in sessions (Notion),
// camp mornings, MVF classes, and the Fall 2026 season holds — in one shape.
// Consumers: the Google Calendar mirror (.claude/skills/calendar-sync), AI
// schedulers, and any cross-brand surface that needs more than sessions.
//
// Public area / public location only, no child PII, no seat counts — see
// events-feed.ts + invariant-events-feed-egress.spec.ts. CDN-cached to match the
// 5-min ISR on /schedule, same as the sessions feed.
export const revalidate = 300;

export async function GET() {
  // A Notion outage must not blank the static half of the feed — camps, MVF,
  // and the fall season are file-backed and always answerable.
  let sessions = await fetchUpcomingSessions().catch((err) => {
    console.error("[events-feed] session fetch failed", err);
    return null;
  });

  const sessionsUnavailable = sessions === null;
  sessions ??= [];

  const items = buildEventsFeed({ sessions });

  return NextResponse.json(
    {
      _meta: {
        source: "nga_events",
        count: items.length,
        // Downstream mirrors must NOT delete session events on a Notion blip —
        // an empty session list here is "unknown", not "cancelled".
        sessionsUnavailable,
      },
      events: items,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
