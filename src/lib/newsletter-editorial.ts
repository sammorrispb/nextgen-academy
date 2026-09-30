export interface NewsletterEditorial {
  leadPageId: string;
  subject: string;
  previewText: string;
  headline: string;
  intro: string;
}

/** Editorial framing expires with its issue and never bypasses Notion approval. */
export function newsletterEditorial(
  today: string,
  approvedDrafts: { pageId: string; html: string; text: string }[],
): NewsletterEditorial | null {
  const leadPageId = "3ebfa3ac-27dc-8167-8030-e58c8c7bbe8e";
  if (today !== "2026-10-01" || !approvedDrafts.some(
    draft => draft.pageId === leadPageId && draft.html.trim() && draft.text.trim(),
  )) return null;

  return {
    leadPageId,
    subject: "Your player's winter pickleball options",
    previewText: "Indoor plans for Montgomery Village and Frederick. Tell us what works for your family.",
    headline: "Your player's winter pickleball options",
    intro: "You can help shape indoor winter play in Montgomery Village and Frederick. Tell us what works for your family.",
  };
}
