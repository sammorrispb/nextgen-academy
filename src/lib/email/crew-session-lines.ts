import type { MatchableSession } from "@/lib/crew-matching";

/**
 * Presentation shape for an open session surfaced in a crew email (welcome +
 * 7-day re-engagement). Keeping the formatter in one place means both touches
 * render dates/links identically.
 */
export interface CrewSessionLine {
  title: string;
  dateLabel: string;
  timeLabel: string;
  location: string;
  url: string;
}

import { sessionToSlug } from "@/lib/session-slug";

function formatDate(isoDate: string): string {
  if (!isoDate) return "";
  // Noon-UTC anchor avoids a UTC-build day shift (never `new Date(y,m,d)`).
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatCrewSessionLines(
  sessions: MatchableSession[],
  origin: string,
  limit = 3,
): CrewSessionLine[] {
  return sessions.slice(0, limit).map((s) => {
    const slug =
      s.title && s.date ? sessionToSlug({ title: s.title, date: s.date }) : "";
    const url = slug ? `${origin}/schedule/${slug}` : `${origin}/schedule`;
    const timeLabel = [s.startTime, s.endTime].filter(Boolean).join("–");
    return {
      title: s.title,
      dateLabel: formatDate(s.date),
      timeLabel,
      location: s.location || s.publicArea,
      url,
    };
  });
}
