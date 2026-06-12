export interface RosterMailtoInput {
  emails: string[];
  sessionTitle: string;
  prettyDate: string;
  startTime: string;
  endTime?: string;
  location?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Group mailto for a session roster — recipients go in bcc so parents never
 * see each other's addresses. Returns null when no valid recipients. Client-
 * safe (no Node APIs); mirrors the coach-dashboard group email.
 */
export function buildRosterMailto(input: RosterMailtoInput): string | null {
  const emails = [
    ...new Set(
      input.emails.map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)),
    ),
  ];
  if (emails.length === 0) return null;

  const when = `${input.prettyDate}${input.startTime ? ` at ${input.startTime}` : ""}${
    input.endTime ? `–${input.endTime}` : ""
  }`;
  const venue = input.location ? ` (${input.location.split(",")[0]})` : "";
  const subject = encodeURIComponent(`Heads up — ${input.sessionTitle} on ${input.prettyDate}`);
  const body = encodeURIComponent(
    `Hi parents,\n\nQuick note about ${input.sessionTitle} on ${when}${venue}.\n\n— Sam`,
  );
  return `mailto:?bcc=${emails.join(",")}&subject=${subject}&body=${body}`;
}
