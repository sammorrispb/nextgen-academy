import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { site } from "@/data/site";
import {
  NOTION_API,
  NGA_FROM_EMAIL,
  fetchPlayer,
  firstName,
  childFirstName,
  richText,
  title,
} from "@/lib/eval-shared";

type Level = "Red" | "Orange" | "Green" | "Yellow";

const LEVEL_DESCRIPTIONS: Record<Level, string> = {
  Red: "Building the foundation — basic strokes, footwork, ready position. Pure introduction.",
  Orange:
    "Developing — can rally 3+ balls, learning consistent contact and court awareness.",
  Green:
    "Consistent — full-court play, learning strategy and mid-game decisions.",
  Yellow:
    "Competitive — full game, working on shot selection and tournament fundamentals.",
};

const LEVEL_SET = new Set(Object.keys(LEVEL_DESCRIPTIONS));

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
          rich_text: [
            {
              text: {
                content: `Post-eval email sent ${today}. Awaiting registration.`,
              },
            },
          ],
        },
      },
    }),
  });
}

function buildEmailHtml(args: {
  parentFirstName: string;
  childFirstName: string;
  level: Level;
  levelDescription: string;
  observations: string;
}): string {
  const obsBlock = args.observations.trim()
    ? `<p style="font-size: 15px; line-height: 1.6; margin: 16px 0;"><strong style="color: #7A88B8;">What I saw:</strong><br/>${args.observations.replace(/\n/g, "<br/>")}</p>`
    : "";

  return `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 16px;">
    ${args.childFirstName === "your child" ? "Evaluation" : args.childFirstName + "'s evaluation"} — next steps
  </h1>
  <p style="font-size: 15px; line-height: 1.6;">Hi ${args.parentFirstName},</p>
  <p style="font-size: 15px; line-height: 1.6;">Thanks for bringing ${args.childFirstName} out today. Quick recap and what I'd recommend next.</p>

  <div style="background: #0C1F47; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #AADC00;">
    <p style="margin: 0 0 4px; font-size: 13px; color: #7A88B8; text-transform: uppercase; letter-spacing: 1px;">Starting level</p>
    <p style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #AADC00;">${args.level} Ball</p>
    <p style="margin: 0; font-size: 14px; color: #EEF2FF; line-height: 1.5;">${args.levelDescription}</p>
  </div>

  ${obsBlock}

  <p style="font-size: 15px; line-height: 1.6;"><strong style="color: #7A88B8;">Where to go from here:</strong></p>
  <p style="font-size: 15px; line-height: 1.6;">The best fit right now is a ${args.level} Ball drop-in slot. Our current upcoming sessions:</p>
  <ul style="font-size: 15px; line-height: 1.7; padding-left: 20px;">
    <li>Sat May 23 — Walter Johnson HS, Bethesda (Early 4:30 + Late 5:30 PM)</li>
    <li>Sun May 24 — Gaithersburg HS (Early 4:30 + Late 5:30 PM)</li>
    <li>Sat May 30 — Sherwood HS, Sandy Spring (Early 10:00 + Late 11:00 AM)</li>
  </ul>
  <p style="font-size: 15px; line-height: 1.6;">$40 per 1-hour slot ($80 for both slots in a session).</p>
  <p style="font-size: 15px; line-height: 1.6; margin: 16px 0;">
    <a href="https://nextgenpbacademy.com/schedule" style="display: inline-block; background: #AADC00; color: #05132B; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700;">Reserve a slot</a>
  </p>

  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1A3060;">
    <p style="font-size: 14px; line-height: 1.6;">Reply to this email or text me at <a href="tel:${site.phone}" style="color: #00D4FF;">${site.phone}</a> to talk through level or venue.</p>
    <p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
      See you on the court!<br/>
      <strong style="color: #AADC00;">— Coach Sam</strong><br/>
      <span style="color: #7A88B8;">Co-Founder &amp; Head Coach, Next Gen Pickleball Academy</span><br/>
      <a href="${site.website}" style="color: #00D4FF;">nextgenpbacademy.com</a>
    </p>
  </div>
</div>`;
}

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const expected = process.env.NGA_ADMIN_SECRET;
  if (!expected || secret !== expected) {
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

  const cfn = childFirstName(playerName);
  const html = buildEmailHtml({
    parentFirstName: firstName(parentName),
    childFirstName: cfn,
    level: body.level,
    levelDescription: LEVEL_DESCRIPTIONS[body.level],
    observations: body.observations ?? "",
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
