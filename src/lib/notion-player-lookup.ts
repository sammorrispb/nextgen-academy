// Returns true when the parent (looked up by email OR phone in the NGA Player
// CRM) has no prior row — used to gate first-touch perks like the WhatsApp
// parent-group invite. Defaults to `false` if Notion is unavailable so we
// don't re-prompt returning families when the lookup fails.

const NOTION_API = "https://api.notion.com/v1";
const NOTION_DB_ID = "1e5e34c258384c6cb5f3e846543ecfc7";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function isFirstTimeParent(contact: string): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return false;

  const trimmed = contact.trim();
  if (!trimmed) return false;

  const filter = EMAIL_RE.test(trimmed)
    ? { property: "Parent Email", email: { equals: trimmed } }
    : { property: "Parent Phone", phone_number: { equals: trimmed } };

  try {
    const res = await fetch(`${NOTION_API}/databases/${NOTION_DB_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ filter, page_size: 1 }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { results?: unknown[] };
    return (data.results?.length ?? 0) === 0;
  } catch {
    return false;
  }
}
