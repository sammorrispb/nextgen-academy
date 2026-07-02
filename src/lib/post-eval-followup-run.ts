/**
 * Core engine for the post-eval follow-up — extracted from
 * src/app/api/post-eval-followup/route.ts (Phase 2b of the admin-reduction
 * roadmap) so the secret-gated curl route and the /coach/ops server action run
 * the IDENTICAL flow: fetch player → live session lines for the level → build
 * the branded email → send to the PARENT → stamp Level/Status/Next Action on
 * the CRM row. Mirrors eval-confirmation-send.ts (one lib, two callers);
 * e2e/invariant-ops-trigger-parity.spec.ts pins route === core.
 *
 * dryRun (new with the ops page, additive for the curl via ?dryRun=1) stops
 * after building the email: no Resend send, no Notion write.
 */

import { Resend } from "resend";
import { site } from "@/data/site";
import {
  NGA_FROM_EMAIL,
  NOTION_API,
  fetchPlayer,
  firstName,
  childFirstName,
  richText,
  title,
} from "@/lib/eval-shared";
import {
  LEVEL_DESCRIPTIONS,
  isPrivateBridgeLevel,
  formatSessionLine,
  buildPostEvalFollowupHtml,
  type Level,
} from "@/lib/email/post-eval-followup";
import { fetchUpcomingSessions } from "@/lib/notion-sessions";

const LEVEL_SET = new Set(Object.keys(LEVEL_DESCRIPTIONS));
const MAX_SESSION_LINES = 5;

export interface PostEvalBody {
  playerId?: string;
  level?: Level;
  observations?: string;
}

export interface PostEvalRunResult {
  status: number;
  body: Record<string, unknown>;
}

async function updatePlayer(
  playerId: string,
  notionKey: string,
  level: Level,
  today: string,
) {
  const nextAction = isPrivateBridgeLevel(level)
    ? `Post-eval email sent ${today}. **Send private-lesson quote within 24h** (use pricing guide).`
    : `Post-eval email sent ${today}. Awaiting registration.`;

  await fetch(`${NOTION_API}/pages/${playerId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      properties: {
        Level: { select: { name: level } },
        Status: { select: { name: "Active" } },
        "Last Contact Date": { date: { start: today } },
        "Next Action": {
          rich_text: [{ text: { content: nextAction } }],
        },
      },
    }),
  });
}

/**
 * Live upcoming-session lines for a group level (Green/Yellow). Pulls the
 * Sessions DB, keeps Open sessions that match the level (or are unleveled), and
 * formats up to MAX_SESSION_LINES. Fail-soft: a Notion miss returns [] and the
 * email renders its "new sessions post regularly" fallback rather than erroring.
 */
async function fetchSessionLinesForLevel(level: Level): Promise<string[]> {
  try {
    const sessions = await fetchUpcomingSessions();
    // Group levels (Green/Yellow) can attend their own level OR an unleveled
    // general session. Private-bridge levels (Red/Orange) only see sessions
    // explicitly opened to their level — the all-levels Tuesday court — and
    // never unleveled weekend rows, which assume rally-ready group play.
    const matches = isPrivateBridgeLevel(level)
      ? (l: Level | null) => l === level
      : (l: Level | null) => l === level || l === null;
    return sessions
      .filter((s) => s.status === "Open" && s.spotsLeft > 0)
      .filter((s) => matches(s.level))
      .slice(0, MAX_SESSION_LINES)
      .map((s) =>
        formatSessionLine({
          date: s.date,
          startTime: s.startTime,
          location: s.location,
          publicArea: s.publicArea,
        }),
      );
  } catch (err) {
    console.error("[post-eval-followup] session fetch failed:", err);
    return [];
  }
}

export async function runPostEvalFollowup(
  body: PostEvalBody,
  opts: { dryRun?: boolean } = {},
): Promise<PostEvalRunResult> {
  const dryRun = opts.dryRun === true;

  // Preview needs Notion (player + sessions) but not Resend — a dead send key
  // must never block seeing who WOULD be emailed.
  if (!dryRun && !process.env.RESEND_API_KEY) {
    return { status: 500, body: { error: "Resend not configured" } };
  }
  if (!process.env.NOTION_API_KEY) {
    return { status: 500, body: { error: "Notion not configured" } };
  }

  if (!body.playerId || typeof body.playerId !== "string") {
    return { status: 400, body: { error: "playerId required" } };
  }
  if (!body.level || !LEVEL_SET.has(body.level)) {
    return {
      status: 400,
      body: { error: "level required: Red | Orange | Green | Yellow" },
    };
  }

  const player = await fetchPlayer(body.playerId, process.env.NOTION_API_KEY);
  if (!player) {
    return { status: 404, body: { error: "Player not found" } };
  }

  const props = player.properties ?? {};
  const parentEmail: string | null = props["Parent Email"]?.email ?? null;
  const parentName = richText(props["Parent Name"]);
  const playerName = title(props["Player Name"]);

  if (!parentEmail) {
    return { status: 422, body: { error: "Player row has no Parent Email" } };
  }

  // Every level gets a live session lookup now. Green/Yellow see general
  // sessions; Red/Orange see only sessions explicitly opened to their level
  // (the all-levels Tuesday court), surfaced as a group on-ramp beneath the
  // private-lesson recommendation.
  const sessionLines = await fetchSessionLinesForLevel(body.level);

  const cfn = childFirstName(playerName);
  const html = buildPostEvalFollowupHtml({
    parentFirstName: firstName(parentName),
    childFirstName: cfn,
    level: body.level,
    levelDescription: LEVEL_DESCRIPTIONS[body.level],
    observations: body.observations ?? "",
    sessionLines,
  });

  const subjectChildLabel = cfn === "your child" ? "Your child" : cfn;
  const subject = `${subjectChildLabel}'s evaluation — next steps at Next Gen`;

  if (dryRun) {
    return {
      status: 200,
      body: {
        ok: true,
        dryRun: true,
        to: parentEmail,
        subject,
        level: body.level,
        sessions_listed: sessionLines.length,
        preview_html: html,
      },
    };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: NGA_FROM_EMAIL,
      to: parentEmail,
      replyTo: site.email,
      subject,
      html,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return {
        status: 500,
        body: { error: "Email send failed", detail: result.error },
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    await updatePlayer(body.playerId, process.env.NOTION_API_KEY!, body.level, today);

    return {
      status: 200,
      body: {
        success: true,
        sent_to: parentEmail,
        level: body.level,
        sessions_listed: sessionLines.length,
        notion_updated: true,
      },
    };
  } catch (err) {
    console.error("post-eval-followup failed:", err);
    return {
      status: 500,
      body: { error: "Internal error", detail: String(err) },
    };
  }
}
