export interface NewsletterEditorial {
  leadPageId: string;
  subject: string;
  previewText: string;
  headline: string;
  intro: string;
  excludedProgramKeys?: string[];
}

const ISSUE_EDITORIAL: Record<string, NewsletterEditorial[]> = {
  "2026-10-01": [
    {
      leadPageId: "3ebfa3ac-27dc-813f-b2f2-c0b5beb68332",
      subject: "Your player's winter pickleball options",
      previewText: "Indoor plans for Montgomery Village and Frederick. Tell us what works for your family.",
      headline: "Your player's winter pickleball options",
      intro: "You can help shape indoor winter play in Montgomery Village and Frederick. Tell us what works for your family.",
      excludedProgramKeys: ["winter-interest", "mvf-junior-tournament"],
    },
    {
      leadPageId: "3ebfa3ac-27dc-8167-8030-e58c8c7bbe8e",
      subject: "Your player's winter pickleball options",
      previewText: "Indoor plans for Montgomery Village and Frederick. Tell us what works for your family.",
      headline: "Your player's winter pickleball options",
      intro: "You can help shape indoor winter play in Montgomery Village and Frederick. Tell us what works for your family.",
      excludedProgramKeys: ["winter-interest"],
    },
  ],
  "2026-10-08": [{
    leadPageId: "3ebfa3ac-27dc-8192-be55-f3feaaea8244",
    subject: "A game-day goal for your player: October 24",
    previewText: "No fixed partner needed. Four games or more at North Creek.",
    headline: "A game-day goal for your player: October 24",
    intro: "You can give your player a day to put their practice into games with new partners. Here are the format, age and payment details for October 24.",
    excludedProgramKeys: ["mvf-junior-tournament"],
  }],
};

/** Editorial framing expires with its issue and never bypasses Notion approval. */
export function newsletterEditorial(
  today: string,
  approvedDrafts: { pageId: string; html: string; text: string }[],
): NewsletterEditorial | null {
  return (ISSUE_EDITORIAL[today] ?? []).find(editorial => approvedDrafts.some(
    draft => draft.pageId === editorial.leadPageId && draft.html.trim() && draft.text.trim(),
  )) ?? null;
}
