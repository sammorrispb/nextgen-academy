// Mirrors a paid drop-in registration into the NGA Player CRM (the Player
// Database, NOTION_DB_ID). The drop-in row (NOTION_DROPINS_DB_ID) stays the
// transactional source of truth; this keeps the Player DB current so a website
// registration shows up there too — historically only the lead form path
// (/api/lead) wrote to the Player DB, so paid registrations never landed a
// player row. Best-effort: the Stripe webhook swallows the result so a CRM
// blip never triggers a webhook retry / double-charge replay.

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const NOTION_DB_ID = "1e5e34c258384c6cb5f3e846543ecfc7";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Player DB "Site" select options. The drop-in's free-form session location is
// only stamped onto Site when it maps to one of these — an unknown select value
// 400s the whole Notion write, which would drop the Last Attended update too.
const SITE_OPTIONS = [
  "Redland MS",
  "Shannon MS",
  "Frost MS",
  "Gaithersburg HS",
  "Sherwood HS",
  "Westland MS",
  "Cabin John MS",
  "Olney area",
  "Camp",
  "Other / TBD",
] as const;

export interface DropInPlayerSync {
  parentName: string;
  parentEmail: string | null;
  parentPhone: string;
  childFirstName: string;
  childBirthYear: number;
  sessionDate: string; // ISO YYYY-MM-DD
  location: string;
}

export type PlayerSyncResult = "created" | "updated" | "skipped" | "error";

// New paid drop-ins in May are signing up for the Summer cohort, etc. Mirrors
// the lead route's labeling so a registration-created row tags the same season.
export function currentSeasonLabel(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-11
  if (m >= 0 && m <= 1) return `Winter ${y}`;
  if (m === 11) return `Winter ${y + 1}`;
  if (m >= 2 && m <= 4) return `Spring ${y}`;
  if (m >= 5 && m <= 7) return `Summer ${y}`;
  return `Fall ${y}`;
}

// Whole-year approximation — the Player DB tracks Age, not birthdate, and a
// drop-in only carries the birth year.
export function ageFromBirthYear(birthYear: number, now: Date = new Date()): number | undefined {
  if (!birthYear || birthYear < 1900) return undefined;
  const age = now.getUTCFullYear() - birthYear;
  return age >= 0 && age <= 100 ? age : undefined;
}

export function matchSite(location: string): string | undefined {
  const loc = location?.trim().toLowerCase();
  if (!loc) return undefined;
  return SITE_OPTIONS.find((o) => loc.includes(o.toLowerCase()));
}

function notionHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

// Finds the player row for THIS child: a family shares one Parent Email/Phone
// across multiple per-child rows, so we narrow by Player Name too. Returns the
// page id or null.
async function findPlayerRow(
  notionKey: string,
  email: string | null,
  phone: string,
  childFirstName: string,
): Promise<string | null> {
  const contactFilter =
    email && EMAIL_RE.test(email)
      ? { property: "Parent Email", email: { equals: email } }
      : phone
        ? { property: "Parent Phone", phone_number: { equals: phone } }
        : null;
  if (!contactFilter) return null;

  const child = childFirstName?.trim();
  const filter = child
    ? { and: [contactFilter, { property: "Player Name", title: { contains: child } }] }
    : contactFilter;

  const res = await fetch(`${NOTION_API}/databases/${NOTION_DB_ID}/query`, {
    method: "POST",
    headers: notionHeaders(notionKey),
    body: JSON.stringify({ filter, page_size: 1 }),
  });
  if (!res.ok) throw new Error(`player query failed (${res.status})`);
  const data = (await res.json()) as { results?: { id: string }[] };
  return data.results?.length ? data.results[0].id : null;
}

// Upserts the player row from a paid drop-in. On an existing row we only touch
// Last Attended + reactivate Status — Site, Level, and Skill Rating are
// coach-owned and must not be clobbered by an automated registration sync.
export async function syncPlayerFromDropIn(d: DropInPlayerSync): Promise<PlayerSyncResult> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return "skipped";

  const email = d.parentEmail?.trim() || null;
  const phone = d.parentPhone?.trim() || "";
  if (!email && !phone) return "skipped";

  try {
    const existingId = await findPlayerRow(notionKey, email, phone, d.childFirstName);

    if (existingId) {
      const res = await fetch(`${NOTION_API}/pages/${existingId}`, {
        method: "PATCH",
        headers: notionHeaders(notionKey),
        body: JSON.stringify({
          properties: {
            "Last Attended": { date: { start: d.sessionDate } },
            Status: { select: { name: "Active" } },
          },
        }),
      });
      if (!res.ok) throw new Error(`player update failed (${res.status})`);
      return "updated";
    }

    const titleText = d.childFirstName.trim() || `Child of ${d.parentName}`;
    const age = ageFromBirthYear(d.childBirthYear);
    const site = matchSite(d.location);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      "Player Name": { title: [{ text: { content: titleText } }] },
      "Parent Name": { rich_text: [{ text: { content: d.parentName } }] },
      Status: { select: { name: "Active" } },
      Source: { select: { name: "Website" } },
      Audience: { select: { name: "Youth" } },
      Season: { select: { name: currentSeasonLabel() } },
      "Last Attended": { date: { start: d.sessionDate } },
      Notes: {
        rich_text: [
          { text: { content: "Auto-created from a paid website drop-in registration." } },
        ],
      },
    };
    if (email) properties["Parent Email"] = { email };
    if (phone) properties["Parent Phone"] = { phone_number: phone };
    if (age !== undefined) properties.Age = { number: age };
    if (site) properties.Site = { select: { name: site } };

    const res = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: notionHeaders(notionKey),
      body: JSON.stringify({ parent: { database_id: NOTION_DB_ID }, properties }),
    });
    if (!res.ok) throw new Error(`player create failed (${res.status})`);
    return "created";
  } catch (err) {
    console.error("[notion-player-sync] upsert failed", err);
    return "error";
  }
}
