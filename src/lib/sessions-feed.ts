/**
 * Public NGA sessions feed — the read model behind GET /api/sessions/feed.
 *
 * Powers the cross-brand Link & Dink schedule page (www.linkanddink.com/schedule),
 * which lists L&D + NGA events together and links each one out to its own
 * registration surface. This feed is the NGA half: session metadata + AGGREGATE
 * counts ONLY. It deliberately carries NO child PII (no roster names, no birth
 * year / age stats) — those live on `NgaSession` but are never copied here. The
 * no-PII guarantee is pinned by `e2e/invariant-sessions-feed-pii-egress.spec.ts`
 * (COPPA / Minor-Data Governance).
 *
 * Grouping mirrors the public /schedule page: the four all-levels courts that
 * share a date+time+venue collapse into one "pick your color" entry (via
 * `groupSessions`), so the feed row matches what a parent sees.
 */
import type { NgaSession } from "@/lib/notion-sessions";
import { groupSessions, sortByLevel, aggregateSeats } from "@/lib/schedule-grouping";
import { sessionToSlug } from "@/lib/session-slug";
import { publicLocation } from "@/lib/session-location";

export interface SessionFeedItem {
  /** Notion page id of the (representative) session. */
  id: string;
  /** Display title — base name (level suffix stripped) for grouped multi-level entries. */
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  /** Public-safe venue (exact venue when set, broad area fallback) — never a hidden venue. */
  location: string;
  /** Single-session level, or null for a grouped multi-level entry. */
  level: NgaSession["level"];
  /** Levels offered (one per court) for a grouped entry; single level for a single. */
  levels: string[];
  capacity: number;
  registeredCount: number;
  spotsLeft: number;
  status: "Open" | "Full";
  /** Direct registration surface on nextgenpbacademy.com. */
  registerUrl: string;
}

/** Base name with a trailing "— Level" / "- Level" slot suffix stripped. */
function baseTitle(title: string): string {
  const [head] = title.split(/\s*[—–-]\s*/);
  return head?.trim() || title.trim();
}

function originFrom(siteOrigin?: string): string {
  return (
    siteOrigin ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://nextgenpbacademy.com"
  ).replace(/\/$/, "");
}

/**
 * Build the public feed from upcoming sessions. Pure: takes already-fetched
 * sessions so it's unit-testable without Notion. Groups per day (same
 * date+time+venue → one entry) and emits only registration-safe fields.
 *
 * - single session  → links to /schedule/<slug> (the per-session reserve page)
 * - grouped levels  → links to /schedule (parent expands and picks a color)
 */
export function buildSessionsFeed(
  sessions: NgaSession[],
  siteOrigin?: string,
): SessionFeedItem[] {
  const origin = originFrom(siteOrigin);

  // Preserve the sessions' ascending-date order while bucketing by day.
  const byDate = new Map<string, NgaSession[]>();
  for (const s of sessions) {
    const arr = byDate.get(s.date) ?? [];
    arr.push(s);
    byDate.set(s.date, arr);
  }

  const out: SessionFeedItem[] = [];
  for (const daySessions of byDate.values()) {
    for (const item of groupSessions(sortByLevel(daySessions))) {
      if (item.kind === "single") {
        const s = item.session;
        if (s.status !== "Open" && s.status !== "Full") continue;
        out.push({
          id: s.id,
          title: s.title,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          location: publicLocation(s.location, s.publicArea),
          level: s.level,
          levels: s.level ? [s.level] : [],
          capacity: s.capacity,
          registeredCount: s.registeredCount,
          spotsLeft: s.spotsLeft,
          status: s.status,
          registerUrl: `${origin}/schedule/${sessionToSlug(s)}`,
        });
      } else {
        const first = item.sessions[0];
        const { capacity, registered, spotsLeft, allFull } = aggregateSeats(
          item.sessions,
        );
        out.push({
          id: first.id,
          title: baseTitle(first.title),
          date: first.date,
          startTime: first.startTime,
          endTime: first.endTime,
          location: publicLocation(first.location, first.publicArea),
          level: null,
          levels: item.sessions
            .map((s) => s.level)
            .filter((l): l is NonNullable<NgaSession["level"]> => l !== null),
          capacity,
          registeredCount: registered,
          spotsLeft,
          status: allFull ? "Full" : "Open",
          // Grouped multi-level slot — parent picks a color on the schedule page.
          registerUrl: `${origin}/schedule`,
        });
      }
    }
  }
  return out;
}
