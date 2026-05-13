export const NOTION_API = "https://api.notion.com/v1";
export const NGA_FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

export function richText(
  p: { rich_text?: Array<{ plain_text?: string }> } | undefined,
): string {
  if (!p?.rich_text) return "";
  return p.rich_text.map((t) => t.plain_text ?? "").join("");
}

export function title(
  p: { title?: Array<{ plain_text?: string }> } | undefined,
): string {
  if (!p?.title) return "";
  return p.title.map((t) => t.plain_text ?? "").join("");
}

export function firstName(full: string): string {
  const trimmed = full.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

export function childFirstName(playerName: string): string {
  const trimmed = playerName.trim();
  if (!trimmed || trimmed.toLowerCase().startsWith("child of")) {
    return "your child";
  }
  return trimmed.split(/\s+/)[0];
}

export async function fetchPlayer(playerId: string, notionKey: string) {
  const res = await fetch(`${NOTION_API}/pages/${playerId}`, {
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Notion-Version": "2022-06-28",
    },
  });
  if (!res.ok) return null;
  return res.json();
}
