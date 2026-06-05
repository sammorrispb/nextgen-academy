import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  evalConfirmationHtml,
  evalConfirmationText,
  evalConfirmationSubject,
} from "@/lib/email/eval-confirmation";
import { buildDropInIcs } from "@/lib/email/ics";
import { setEvalDate } from "@/lib/notion-eval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const ADMIN_BCC = "nextgenacademypb@gmail.com";

interface EvalBody {
  parentEmail?: string;
  parentFirst?: string;
  childFirst?: string;
  date?: string; // "YYYY-MM-DD"
  startTime?: string; // "10:00 AM"
  endTime?: string; // "10:45 AM"
  location?: string;
  coachName?: string;
  dryRun?: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}\s*(AM|PM)$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Date-only string → "Tuesday, June 9, 2026". Anchored at noon UTC so the
// weekday/day never shifts on a UTC build server (the date-only off-by-one trap).
function formatLongDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatShortDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.NGA_ADMIN_SECRET || secret !== process.env.NGA_ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: EvalBody;
  try {
    body = (await req.json()) as EvalBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parentEmail = (body.parentEmail ?? "").trim();
  const parentFirst = (body.parentFirst ?? "").trim() || "there";
  const childFirst = (body.childFirst ?? "").trim();
  const date = (body.date ?? "").trim();
  const startTime = (body.startTime ?? "").trim();
  const endTime = (body.endTime ?? "").trim();
  const location = (body.location ?? "").trim();
  const coachName = (body.coachName ?? "").trim() || "Coach Sam";

  // Validate required fields up front so a malformed call never half-sends.
  const errors: string[] = [];
  if (!EMAIL_RE.test(parentEmail)) errors.push("parentEmail must be a valid email");
  if (!childFirst) errors.push("childFirst is required");
  if (!DATE_RE.test(date)) errors.push("date must be YYYY-MM-DD");
  if (!TIME_RE.test(startTime)) errors.push('startTime must be like "10:00 AM"');
  if (!TIME_RE.test(endTime)) errors.push('endTime must be like "10:45 AM"');
  if (!location) errors.push("location is required");
  if (errors.length) {
    return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
  }

  const dateLong = formatLongDate(date);
  const shortDate = formatShortDate(date);
  const subject = evalConfirmationSubject(childFirst, shortDate, startTime);
  const tmplInput = {
    parentFirst,
    childFirst,
    dateLong,
    startTime,
    endTime,
    location,
    coachName,
  };

  const ics = buildDropInIcs({
    uid: `eval-${date}-${encodeURIComponent(childFirst.toLowerCase())}@nextgenpbacademy.com`,
    date,
    startTime,
    endTime,
    title: `${childFirst}'s Free Evaluation with ${coachName} (NGA)`,
    location,
    description: `Free evaluation with ${coachName}, Next Gen Pickleball Academy. Wear athletic clothes and court shoes, bring water. Paddle loaners available.`,
  });
  if (!ics) {
    return NextResponse.json(
      { error: "Could not build calendar invite — check startTime/endTime format" },
      { status: 400 },
    );
  }

  if (body.dryRun === true || req.nextUrl.searchParams.get("dryRun") === "1") {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      to: parentEmail,
      subject,
      dateLong,
      preview: evalConfirmationText(tmplInput),
    });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 500 });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: parentEmail,
    bcc: ADMIN_BCC,
    replyTo: REPLY_TO,
    subject,
    html: evalConfirmationHtml(tmplInput),
    text: evalConfirmationText(tmplInput),
    attachments: [
      {
        filename: `${childFirst.toLowerCase()}-eval-${date}.ics`,
        content: Buffer.from(ics, "utf-8").toString("base64"),
        contentType: "text/calendar; charset=utf-8; method=PUBLISH",
      },
    ],
  });
  if (error) {
    return NextResponse.json(
      { error: `Resend failed: ${error.message ?? String(error)}` },
      { status: 502 },
    );
  }

  // Stamp the CRM after a successful send. Fail-soft — a Notion miss never
  // turns a delivered email into an error response.
  const crm = await setEvalDate(parentEmail, date);

  console.log(
    "[eval-confirmation]",
    JSON.stringify({ to: parentEmail, date, crm_updated: crm.updated }),
  );
  return NextResponse.json({
    ok: true,
    sent: true,
    to: parentEmail,
    subject,
    crm,
  });
}
