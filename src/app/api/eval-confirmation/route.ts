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

interface EvalConfirmBody {
  playerId: string;
  startISO: string;
  durationMinutes?: number;
  venueName: string;
  venueAddress: string;
  evalCoach?: "Sam" | "Amine";
}

function icsTimestamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function generateIcs(args: {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  location: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
}): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Next Gen Pickleball Academy//Eval//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${args.uid}`,
    `DTSTAMP:${icsTimestamp(new Date())}`,
    `DTSTART:${icsTimestamp(args.start)}`,
    `DTEND:${icsTimestamp(args.end)}`,
    `SUMMARY:${icsEscape(args.summary)}`,
    `DESCRIPTION:${icsEscape(args.description)}`,
    `LOCATION:${icsEscape(args.location)}`,
    `ORGANIZER;CN=Coach Sam:mailto:${args.organizerEmail}`,
    `ATTENDEE;CN=${icsEscape(args.attendeeName)};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${args.attendeeEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function formatEt(date: Date, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    ...opts,
  }).format(date);
}

function buildEmailHtml(args: {
  parentFirstName: string;
  childFirstName: string;
  dateStr: string;
  timeStr: string;
  durationMinutes: number;
  venueName: string;
  venueAddress: string;
}): string {
  const childIs =
    args.childFirstName === "your child" ? "your child" : args.childFirstName;
  return `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 16px;">
    ${childIs === "your child" ? "Evaluation" : childIs + "'s evaluation"} — confirmed
  </h1>
  <p style="font-size: 15px; line-height: 1.6;">Hi ${args.parentFirstName},</p>
  <p style="font-size: 15px; line-height: 1.6;">You're locked in. Here's the detail:</p>

  <div style="background: #0C1F47; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #AADC00;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr><td style="padding: 6px 0; color: #7A88B8; width: 110px;">Date</td><td style="padding: 6px 0; color: #EEF2FF;">${args.dateStr}</td></tr>
      <tr><td style="padding: 6px 0; color: #7A88B8;">Time</td><td style="padding: 6px 0; color: #EEF2FF;">${args.timeStr} (${args.durationMinutes} min)</td></tr>
      <tr><td style="padding: 6px 0; color: #7A88B8;">Venue</td><td style="padding: 6px 0; color: #EEF2FF;">${args.venueName}</td></tr>
      <tr><td style="padding: 6px 0; color: #7A88B8;">Address</td><td style="padding: 6px 0; color: #EEF2FF;">${args.venueAddress}</td></tr>
      <tr><td style="padding: 6px 0; color: #7A88B8;">Coach</td><td style="padding: 6px 0; color: #EEF2FF;">Coach Sam</td></tr>
    </table>
  </div>

  <p style="font-size: 15px; line-height: 1.6;">A calendar invite (.ics) is attached — open it to add the eval to your calendar.</p>

  <p style="font-size: 15px; line-height: 1.6; margin-top: 20px;"><strong style="color: #7A88B8;">What to bring:</strong></p>
  <ul style="font-size: 15px; line-height: 1.7; padding-left: 20px; margin: 8px 0;">
    <li>Sneakers (court shoes preferred but not required)</li>
    <li>Water</li>
    <li>That's it — I'll have paddles, balls, and a portable net</li>
  </ul>

  <p style="font-size: 15px; line-height: 1.6; margin-top: 20px;"><strong style="color: #7A88B8;">Two quick favors:</strong></p>
  <ol style="font-size: 15px; line-height: 1.7; padding-left: 20px; margin: 8px 0;">
    <li>Aim to arrive 5 min early so we use the full ${args.durationMinutes} min on court.</li>
    <li>If anything comes up and you need to reschedule, text me at <a href="tel:${site.phone}" style="color: #00D4FF;">${site.phone}</a> by the night before.</li>
  </ol>

  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1A3060;">
    <p style="font-size: 14px; line-height: 1.6;">
      Looking forward to meeting ${childIs}.<br/>
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

  let body: EvalConfirmBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.playerId || typeof body.playerId !== "string") {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }
  if (!body.startISO || isNaN(new Date(body.startISO).getTime())) {
    return NextResponse.json(
      { error: "startISO required (ISO 8601, e.g. 2026-05-15T16:00:00-04:00)" },
      { status: 400 },
    );
  }
  if (!body.venueName || !body.venueAddress) {
    return NextResponse.json(
      { error: "venueName and venueAddress required" },
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

  const duration = body.durationMinutes ?? 30;
  const evalCoach = body.evalCoach ?? "Sam";
  const start = new Date(body.startISO);
  const end = new Date(start.getTime() + duration * 60 * 1000);

  const parentFn = firstName(parentName);
  const cfn = childFirstName(playerName);
  const dateStr = formatEt(start, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeStr = formatEt(start, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const ics = generateIcs({
    uid: `eval-${body.playerId}-${start.getTime()}@nextgenpbacademy.com`,
    start,
    end,
    summary: `Free Evaluation — ${cfn === "your child" ? "Next Gen Pickleball Academy" : cfn + " (Next Gen Pickleball Academy)"}`,
    description: `Free ${duration}-min on-court evaluation with Coach Sam.\\n\\nBring: sneakers + water. Paddles, balls, and a portable net provided.\\n\\nReschedule: text 301-325-4731 by the night before.`,
    location: `${body.venueName}, ${body.venueAddress}`,
    organizerEmail: site.email,
    attendeeName: parentName || parentFn,
    attendeeEmail: parentEmail,
  });

  const html = buildEmailHtml({
    parentFirstName: parentFn,
    childFirstName: cfn,
    dateStr,
    timeStr,
    durationMinutes: duration,
    venueName: body.venueName,
    venueAddress: body.venueAddress,
  });

  const subjectChildLabel = cfn === "your child" ? "Your child" : cfn;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: NGA_FROM_EMAIL,
      to: parentEmail,
      replyTo: site.email,
      subject: `Confirmed: ${subjectChildLabel}'s free evaluation — ${dateStr}`,
      html,
      attachments: [
        {
          filename: "eval.ics",
          content: Buffer.from(ics, "utf-8").toString("base64"),
        },
      ],
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return NextResponse.json(
        { error: "Email send failed", detail: result.error },
        { status: 500 },
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    await fetch(`${NOTION_API}/pages/${body.playerId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        properties: {
          Status: { select: { name: "Eval Scheduled" } },
          "Eval Coach": { select: { name: evalCoach } },
          "Eval Date": { date: { start: start.toISOString() } },
          "Last Contact Date": { date: { start: today } },
          "Next Action": {
            rich_text: [
              {
                text: {
                  content: `Eval ${dateStr} ${timeStr} at ${body.venueName}. Confirmation sent ${today}.`,
                },
              },
            ],
          },
        },
      }),
    });

    return NextResponse.json({
      success: true,
      sent_to: parentEmail,
      eval_date: start.toISOString(),
      notion_updated: true,
    });
  } catch (err) {
    console.error("eval-confirmation failed:", err);
    return NextResponse.json(
      { error: "Internal error", detail: String(err) },
      { status: 500 },
    );
  }
}
