import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { site } from "@/data/site";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import {
  validateFallInterest,
  type FallInterestFormData,
} from "@/lib/validate-fall-interest";
import { upsertFallInterest } from "@/lib/notion-fall-interest";
import {
  fallInterestConfirmationHtml,
  fallInterestConfirmationSubject,
  fallInterestConfirmationText,
} from "@/lib/email/fall-interest-confirmation";
import { c } from "@/lib/email/brand";
import type {
  FallAdultBracket,
  FallCommitment,
  FallDay,
  FallPriceBand,
  FallYouthLevel,
} from "@/data/fall-2026";

const ADMIN_EMAIL = "sam.morris2131@gmail.com";
const CC_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

const { isRateLimited } = createRateLimiter();

export async function POST(request: NextRequest) {
  let body: Partial<FallInterestFormData>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const errors = validateFallInterest(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: "Validation failed", errors },
      { status: 400 },
    );
  }

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 },
    );
  }

  const track = body.track!;
  const wantsYouth = track.includes("youth");
  const wantsAdult = track.includes("adult");

  const respondentName = body.respondentName!.trim().slice(0, 200);
  const email = body.email!.trim().toLowerCase();
  const phone = body.phone?.trim().slice(0, 40) ?? "";
  const days = body.days as FallDay[];
  const commitment = body.commitment as FallCommitment;
  const subListInterest = body.subListInterest === true;
  const notes = body.notes?.trim().slice(0, 1900) ?? "";
  const firstName = respondentName.split(/\s+/)[0] || "there";

  // Age is collected but never stored — birth year is the coarsest thing that
  // still groups a kid correctly (minor-data governance: don't collect more).
  const childFirstName = wantsYouth
    ? body.childFirstName!.trim().slice(0, 100)
    : undefined;
  const childBirthYear = wantsYouth
    ? new Date().getFullYear() - Number(body.childAge)
    : undefined;
  const childLevel = wantsYouth
    ? (body.childLevel as FallYouthLevel)
    : undefined;
  const adultBracket = wantsAdult
    ? (body.adultBracket as FallAdultBracket)
    : undefined;
  const youthPriceBand = wantsYouth
    ? (body.youthPriceBand as FallPriceBand) || undefined
    : undefined;
  const adultPriceBand = wantsAdult
    ? (body.adultPriceBand as FallPriceBand) || undefined
    : undefined;

  // Hard-fail, unlike the crew-interest form's fail-soft write: the response IS
  // the payload here. Sending a "got it" for an answer we dropped would be a
  // lie, and the whole point of the survey is a complete roster of who replied.
  const upsert = await upsertFallInterest({
    respondentName,
    email,
    phone,
    track,
    childFirstName,
    childBirthYear,
    childLevel,
    adultBracket,
    days,
    commitment,
    subListInterest,
    youthPriceBand,
    adultPriceBand,
    notes,
  });
  if (!upsert.ok) {
    console.error("[fall-interest] notion write failed:", upsert.error);
    return NextResponse.json(
      { error: "Could not save your answer. Please contact us directly." },
      { status: 500 },
    );
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[fall-interest] RESEND_API_KEY missing — skipping emails");
  } else {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const rows: [string, string][] = [
      ["Name", respondentName],
      ["Email", email],
      ...(phone ? ([["Phone", phone]] as [string, string][]) : []),
      ["Track", track.join(", ")],
      ...(childFirstName
        ? ([
            [
              "Child",
              `${childFirstName} (b. ${childBirthYear}, ${childLevel})`,
            ],
          ] as [string, string][])
        : []),
      ...(adultBracket
        ? ([["Adult bracket", adultBracket]] as [string, string][])
        : []),
      ["Days", days.join(", ")],
      ["Commitment", commitment],
      ["Sub list", subListInterest ? "Yes" : "No"],
      ...(youthPriceBand
        ? ([["Youth price band", youthPriceBand]] as [string, string][])
        : []),
      ...(adultPriceBand
        ? ([["Adult price band", adultPriceBand]] as [string, string][])
        : []),
      ...(notes ? ([["Notes", notes]] as [string, string][]) : []),
    ];

    const adminHtml = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: ${c.bgDark}; color: ${c.text}; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: ${c.accentLime}; font-size: 22px; margin-bottom: 24px;">
    Fall 2026 survey response
  </h1>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    ${rows
      .map(
        ([label, value]) =>
          `<tr style="border-bottom: 1px solid ${c.border};"><td style="padding: 10px 8px; color: ${c.muted}; width: 150px;">${escape(label)}</td><td style="padding: 10px 8px; color: ${c.text};">${escape(value)}</td></tr>`,
      )
      .join("")}
  </table>
</div>`;

    const confirmation = {
      firstName,
      tracks: track,
      days,
      commitment,
      subListInterest,
    };

    try {
      await Promise.all([
        resend.emails.send({
          from: FROM_EMAIL,
          to: ADMIN_EMAIL,
          cc: CC_EMAIL,
          subject: `Fall survey — ${respondentName} (${track.join(" + ")})`,
          html: adminHtml,
        }),
        resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          bcc: CC_EMAIL,
          replyTo: site.email,
          subject: fallInterestConfirmationSubject(),
          html: fallInterestConfirmationHtml(confirmation),
          text: fallInterestConfirmationText(confirmation),
        }),
      ]);
    } catch (err) {
      console.error("[fall-interest] email send failed:", err);
    }
  }

  await ingestToOpenBrain({
    email,
    name: respondentName,
    phone: phone || undefined,
    business: "nga",
    source: "nga_fall_interest",
    interest: `Fall 2026 — ${track.join(" + ")} — ${commitment}`,
    utm: {
      source: body.utm_source,
      medium: body.utm_medium,
      campaign: body.utm_campaign,
    },
    metadata: {
      tracks: track,
      days,
      commitment,
      sub_list: subListInterest,
      ...(childFirstName ? { child_first_name: childFirstName } : {}),
      ...(childBirthYear ? { child_birth_year: childBirthYear } : {}),
      ...(childLevel ? { child_level: childLevel } : {}),
      ...(adultBracket ? { adult_bracket: adultBracket } : {}),
      ...(youthPriceBand ? { youth_price_band: youthPriceBand } : {}),
      ...(adultPriceBand ? { adult_price_band: adultPriceBand } : {}),
      is_parent: wantsYouth,
    },
  });

  return NextResponse.json({ success: true });
}

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
