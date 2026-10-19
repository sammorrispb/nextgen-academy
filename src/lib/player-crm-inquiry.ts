/**
 * Every website inquiry lands in the NGA Player CRM, the one sales pipeline.
 *
 * Sam's call (2026-10-19): "Reconcile all league interest and website
 * inquiries to the single CRM sales pipeline." Until then only /api/lead and
 * /api/contact wrote the Player CRM. League interest, the empty-schedule
 * waitlist and crew interest each wrote their own Notion database, and a
 * Yellow Ball inquiry wrote no database at all. So a family who asked about a
 * league never appeared in the pipeline Sam works from, and Open Brain's daily
 * uncontacted-leads nudge (which reads the CRM) could not see them. Open Brain
 * held the only complete copy; the six families it held and the CRM did not
 * were backfilled by hand the same day.
 *
 * This is the one writer those forms share, and it mirrors /api/lead:
 *   - the family is found by parent email, then phone (findFamilyRows);
 *   - a known family gets one dated line through appendLeadInquiry, the SAME
 *     engine the lead form and Open Brain's write-back use, marked `inbound`
 *     so Last Inbound Date moves;
 *   - only a child the family has no row for gets a new row: Status Lead,
 *     Level "Eval Needed" (a parent's self-reported colour goes into Notes,
 *     never into Level, which is coach judgment), Source = the form.
 *
 * The form's own database keeps its row; this adds the CRM, it replaces
 * nothing. Fail-soft throughout: a CRM miss is reported on the admin email's
 * status line and never costs the family their confirmation email.
 *
 * CHILD DATA: the Player CRM is already the sanctioned home for a child's
 * first name and age, written by the lead form on every submission. This
 * writes exactly those two, plus a parent-reported level inside the Notes
 * line. No birth year, no school, nothing a parent typed about OTHER children
 * (crew interest's friends field stays out). Pinned by
 * e2e/invariant-player-crm-inquiry.spec.ts.
 */

import { NOTION_API, NOTION_VERSION, playerCrmDbId } from "./notion-utils";
import {
  appendLeadInquiry,
  findFamilyRows,
  renderInquiryLine,
  todayET,
  type FamilyRow,
  type InquiryEntry,
} from "./notion-lead-enrich";
import { LEAD_LOCATIONS } from "./validate-lead";
import { currentSeasonLabel } from "./notion-player-sync";

/** The CRM `Source` each non-lead form writes. The options exist on the
 * Player CRM; Notion would auto-create them on first write anyway. */
export const CRM_INQUIRY_SOURCES = [
  "League Interest",
  "Waitlist",
  "Crew Interest",
  "Yellow Ball Inquiry",
] as const;
export type CrmInquirySource = (typeof CRM_INQUIRY_SOURCES)[number];

export const NEW_ROW_NEXT_ACTION = "Reach out within 24 hours";

/** Notes is capped near 2000 characters per rich_text item. */
const SUMMARY_MAX = 600;

export interface CrmInquiryKid {
  firstName: string;
  age?: number | null;
}

export interface CrmInquiry {
  source: CrmInquirySource;
  parentName: string;
  email?: string | null;
  phone?: string | null;
  kids: CrmInquiryKid[];
  /** One line for the family's Notes timeline. */
  summary: string;
  /** YYYY-MM-DD in America/New_York. Defaults to today. */
  inquiryDate?: string;
  /** The row this submission created in the form's own database. Becomes the
   * `[sf:…]` replay marker, so replaying the same form row (a backfill, a
   * re-run of this call) never doubles a line. A second submission is a second
   * form row and so a second line, the same as the lead form. */
  sourcePageId?: string;
  /** Written only when it is one of LEAD_LOCATIONS and the row has none. */
  location?: string;
}

export interface CrmInquiryResult {
  /** Human status for the admin email, like the lead form's notionStatus. */
  status: string;
  matchedFamily: boolean;
  created: number;
  appended: boolean;
  duplicate: boolean;
  dryRun?: boolean;
}

/** First word, lowercased: the CRM titles a child "Bsrat Abebe" or "Max 10 yo"
 * where the form says "Bsrat" or "Max", and both are the same child. */
export function childKey(name: string): string {
  return name.trim().toLowerCase().split(/\s+/)[0] ?? "";
}

/** The family's row for this child, if it has one. */
export function findChildRow(rows: FamilyRow[], firstName: string): FamilyRow | undefined {
  const key = childKey(firstName);
  if (!key) return undefined;
  return rows.find((r) => childKey(r.playerName) === key);
}

function clip(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > SUMMARY_MAX ? `${flat.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : flat;
}

function notionHeaders(key: string) {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

/** The properties a new CRM row gets. Exported for the egress spec. */
export function newRowProperties(
  inquiry: CrmInquiry,
  kid: CrmInquiryKid,
  firstLine: string,
  date: string,
  now: Date = new Date(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  const name = kid.firstName.trim() || `Child of ${inquiry.parentName.trim()}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    "Player Name": { title: [{ text: { content: name } }] },
    "Parent Name": { rich_text: [{ text: { content: inquiry.parentName.trim() } }] },
    Level: { select: { name: "Eval Needed" } },
    Status: { select: { name: "Lead" } },
    Source: { select: { name: inquiry.source } },
    Season: { select: { name: currentSeasonLabel(now) } },
    Audience: { select: { name: (kid.age ?? 0) >= 17 ? "Adult" : "Youth" } },
    Notes: { rich_text: [{ text: { content: firstLine } }] },
    "Next Action": { rich_text: [{ text: { content: NEW_ROW_NEXT_ACTION } }] },
    "Last Inbound Date": { date: { start: date } },
  };
  if (typeof kid.age === "number" && Number.isFinite(kid.age)) {
    properties.Age = { number: kid.age };
  }
  const email = inquiry.email?.trim();
  const phone = inquiry.phone?.trim();
  if (email) properties["Parent Email"] = { email };
  if (phone) properties["Parent Phone"] = { phone_number: phone };
  if (inquiry.location && (LEAD_LOCATIONS as readonly string[]).includes(inquiry.location)) {
    properties.Location = { select: { name: inquiry.location } };
  }
  return properties;
}

/** A row must never die for its attribution or a newer column: the same rule
 * as createNotionPageSourceFailSoft, widened to every property a missing
 * column could reject. Only a rejection that names one is retried. */
const OPTIONAL_CREATE_PROPS = ["Source", "Last Inbound Date", "Location"] as const;

async function createRow(
  notionKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Record<string, any>,
): Promise<{ id?: string; error?: string; dropped?: string[] }> {
  const send = (props: Record<string, unknown>) =>
    fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: notionHeaders(notionKey),
      body: JSON.stringify({ parent: { database_id: playerCrmDbId() }, properties: props }),
    });

  const first = await send(properties);
  if (first.ok) return { id: ((await first.json()) as { id?: string }).id };

  const detail = await first.text().catch(() => "");
  const offending = OPTIONAL_CREATE_PROPS.filter(
    (name) => name in properties && detail.includes(name),
  );
  if (offending.length === 0) {
    return { error: `create failed (${first.status}): ${detail.slice(0, 200)}` };
  }
  const retried = { ...properties };
  for (const name of offending) delete retried[name];
  const second = await send(retried);
  if (!second.ok) return { error: `create retry failed (${second.status})` };
  return { id: ((await second.json()) as { id?: string }).id, dropped: [...offending] };
}

/**
 * Record one website inquiry in the Player CRM. Never throws.
 *
 * `dryRun` reads the CRM to decide, writes nothing, and reports what a live
 * call would do, the house rule for every write surface in this repo.
 */
export async function recordCrmInquiry(
  inquiry: CrmInquiry,
  opts: { dryRun?: boolean; now?: Date } = {},
): Promise<CrmInquiryResult> {
  const result: CrmInquiryResult = {
    status: "skipped",
    matchedFamily: false,
    created: 0,
    appended: false,
    duplicate: false,
    ...(opts.dryRun ? { dryRun: true } : {}),
  };

  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return { ...result, status: "skipped (NOTION_API_KEY missing)" };
  const email = inquiry.email?.trim() || null;
  const phone = inquiry.phone?.trim() || null;
  if (!email && !phone) return { ...result, status: "skipped (no parent email or phone)" };

  const date = inquiry.inquiryDate ?? todayET(opts.now);
  const entry: InquiryEntry = {
    date,
    channel: `${inquiry.source} form`,
    summary: clip(inquiry.summary),
    direction: "inbound",
    ...(inquiry.sourcePageId
      ? { messageId: inquiry.sourcePageId.replace(/-/g, ""), messageSource: "site_form" as const }
      : {}),
  };
  const line = renderInquiryLine(entry);
  // A submission always names at least one child slot; an unnamed one becomes
  // "Child of <parent>" so the family still lands.
  const kids = inquiry.kids.length > 0 ? inquiry.kids : [{ firstName: "" }];

  try {
    const rows = await findFamilyRows(email, phone);
    result.matchedFamily = rows.length > 0;
    // An unnamed child of a known family cannot be told apart from the ones on
    // file, so it never forks the family into a new row.
    const newKids = rows.length > 0
      ? kids.filter((k) => k.firstName.trim() && !findChildRow(rows, k.firstName))
      : kids;

    if (opts.dryRun) {
      const parts: string[] = [];
      if (rows.length > 0) parts.push("would append to the existing family");
      if (newKids.length > 0) parts.push(`would create ${newKids.length} row(s)`);
      return { ...result, status: `dry run: ${parts.join(" + ") || "nothing to do"}` };
    }

    const parts: string[] = [];
    if (rows.length > 0) {
      const target = findChildRow(rows, kids[0].firstName) ?? rows[0];
      const location =
        inquiry.location && (LEAD_LOCATIONS as readonly string[]).includes(inquiry.location)
          ? inquiry.location
          : undefined;
      const appended = await appendLeadInquiry(target.id, { ...entry, location }, target);
      result.appended = appended.updated;
      result.duplicate = !!appended.duplicate;
      parts.push(
        appended.updated
          ? "updated existing"
          : appended.duplicate
            ? "already recorded"
            : `update failed (${appended.reason})`,
      );
    }

    const created = await Promise.all(
      newKids.map((kid) =>
        createRow(notionKey, newRowProperties(inquiry, kid, line, date, opts.now)),
      ),
    );
    result.created = created.filter((c) => c.id).length;
    const failed = created.find((c) => c.error);
    if (newKids.length > 0) {
      parts.push(
        failed
          ? `created ${result.created}/${newKids.length} (failed: ${failed.error})`
          : rows.length > 0
            ? `created ${result.created} new child row(s)`
            : result.created === 1
              ? "created"
              : `created ${result.created} rows`,
      );
    }
    return { ...result, status: parts.join(" + ") || "nothing to do" };
  } catch (err) {
    return {
      ...result,
      status: `error (${err instanceof Error ? err.message : "unknown"})`,
    };
  }
}
