import { secretEquals } from "@/lib/secret-compare";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { site } from "@/data/site";
import {
  NGA_FROM_EMAIL,
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOTION_API = "https://api.notion.com/v1";
const LEVEL_SET = new Set(Object.keys(LEVEL_DESCRIPTIONS));
const MAX_SESSION_LINES = 5;

interface PostEvalBody {
  playerId: string;
  level: Level;
  observations?: string;
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

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const expected = process.env.NGA_ADMIN_SECRET;
  if (!secretEquals(secret, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Resend not configured" }, { status: 500 });
  }
  if (!process.env.NOTION_API_KEY) {
    return NextResponse.json({ error: "Notion not configured" }, { status: 500 });
  }

  let body: PostEvalBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.playerId || typeof body.playerId !== "string") {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }
  if (!body.level || !LEVEL_SET.has(body.level)) {
    return NextResponse.json(
      { error: "level required: Red | Orange | Green | Yellow" },
      { status: 400 },
    );
  }

  const player = await fetchPlayer(body.playerId, process.env.NOTION_API_KEY);
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const props = player.properties ?? {};
  const parentEmail: string | null = props["Parent Email"]?.email ?? null;
  const parentName = richText(props["Parent Name"]);
  const playerName = title(props["Player Name"]);

  if (!parentEmail) {
    return NextResponse.json(
      { error: "Player row has no Parent Email" },
      { status: 422 },
    );
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

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: NGA_FROM_EMAIL,
      to: parentEmail,
      replyTo: site.email,
      subject: `${subjectChildLabel}'s evaluation — next steps at Next Gen`,
      html,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return NextResponse.json(
        { error: "Email send failed", detail: result.error },
        { status: 500 },
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    await updatePlayer(body.playerId, process.env.NOTION_API_KEY!, body.level, today);

    return NextResponse.json({
      success: true,
      sent_to: parentEmail,
      level: body.level,
      sessions_listed: sessionLines.length,
      notion_updated: true,
    });
  } catch (err) {
    console.error("post-eval-followup failed:", err);
    return NextResponse.json(
      { error: "Internal error", detail: String(err) },
      { status: 500 },
    );
  }
}
