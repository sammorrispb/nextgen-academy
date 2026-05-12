import type { NgaSession } from "@/lib/notion-sessions";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function sessionToSlug(
  session: Pick<NgaSession, "title" | "date">,
): string {
  // Titles look like "Walter Johnson HS — Early"; em-dash splits school + slot.
  const [school, slot = ""] = session.title.split(/\s*[—–-]\s*/);
  const parts = [slugify(school), session.date, slugify(slot)].filter(Boolean);
  return parts.join("-");
}

export function findSessionBySlug(
  sessions: NgaSession[],
  slug: string,
): NgaSession | undefined {
  return sessions.find((s) => sessionToSlug(s) === slug);
}
