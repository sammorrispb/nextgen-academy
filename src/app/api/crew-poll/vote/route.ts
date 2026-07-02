import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { Resend } from "resend";
import { site } from "@/data/site";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import {
  validatePollVote,
  type Level,
  type Vote,
} from "@/lib/validate-poll-vote";
import {
  fetchPollBySlug,
  upsertPollResponse,
} from "@/lib/notion-crew-polls";
import {
  pollVoteConfirmationHtml,
  pollVoteConfirmationText,
} from "@/lib/email/poll-vote-confirmation";

const ADMIN_EMAIL = "sam.morris2131@gmail.com";
const CC_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

// Per-route in-memory rate limit (5/hr, resets on deploy) — shared impl in
// src/lib/rate-limit.ts; each route keeps its own bucket, as before.
const { isRateLimited } = createRateLimiter();

interface VoteBody {
  pollSlug?: string;
  parentName?: string;
  email?: string;
  phone?: string;
  childFirstName?: string;
  childAge?: string;
  childLevel?: Level;
  vote?: Vote;
  note?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export async function POST(request: NextRequest) {
  let body: VoteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const errors = validatePollVote(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: "Validation failed", errors },
      { status: 400 },
    );
  }

  if (!body.pollSlug?.trim()) {
    return NextResponse.json({ error: "Missing poll" }, { status: 400 });
  }

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 },
    );
  }

  const poll = await fetchPollBySlug(body.pollSlug.trim());
  if (!poll) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }
  if (poll.status !== "Open") {
    return NextResponse.json(
      { error: "This poll is closed." },
      { status: 410 },
    );
  }

  const parentName = body.parentName!.trim();
  const email = body.email!.trim().toLowerCase();
  const phone = body.phone?.trim() ?? "";
  const childFirstName = body.childFirstName!.trim();
  const childAge = Number(body.childAge);
  const childBirthYear = new Date().getFullYear() - childAge;
  const childLevel = body.childLevel as Level;
  const vote = body.vote as Vote;
  const note = body.note?.trim().slice(0, 1900) ?? "";
  const parentFirst = parentName.split(" ")[0] || parentName;

  const upsert = await upsertPollResponse({
    pollId: poll.id,
    parentName,
    email,
    phone,
    childFirstName,
    childBirthYear,
    childLevel,
    vote,
    note,
  });
  if (!upsert.ok) {
    console.error("[crew-poll/vote] notion write failed:", upsert.error);
    return NextResponse.json(
      { error: "Could not save your vote. Please contact us directly." },
      { status: 500 },
    );
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[crew-poll/vote] RESEND_API_KEY missing — skipping emails");
  } else {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const adminHtml = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 24px;">
    Poll vote — ${escape(poll.title)}
  </h1>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8; width: 140px;">Parent</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(parentName)}</td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Email</td><td style="padding: 10px 8px;"><a href="mailto:${escape(email)}" style="color: #00D4FF;">${escape(email)}</a></td></tr>
    ${phone ? `<tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Phone</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(phone)}</td></tr>` : ""}
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Child</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(childFirstName)} (age ${childAge}, ${childLevel})</td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Vote</td><td style="padding: 10px 8px; color: #AADC00; font-weight: 700;">${escape(vote)}</td></tr>
    ${note ? `<tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Note</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(note)}</td></tr>` : ""}
  </table>
</div>`;

    try {
      await Promise.all([
        resend.emails.send({
          from: FROM_EMAIL,
          to: ADMIN_EMAIL,
          cc: CC_EMAIL,
          subject: `Poll vote (${vote}) — ${parentName} for ${poll.title}`,
          html: adminHtml,
        }),
        resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          bcc: ADMIN_EMAIL,
          replyTo: site.email,
          subject: `Got your vote — ${poll.title}`,
          html: pollVoteConfirmationHtml({
            parentFirst,
            childFirst: childFirstName,
            pollTitle: poll.title,
            vote,
            minPartySize: poll.minPartySize,
          }),
          text: pollVoteConfirmationText({
            parentFirst,
            childFirst: childFirstName,
            pollTitle: poll.title,
            vote,
            minPartySize: poll.minPartySize,
          }),
        }),
      ]);
    } catch (err) {
      console.error("[crew-poll/vote] email send failed:", err);
    }
  }

  await ingestToOpenBrain({
    email,
    name: parentName,
    phone: phone || undefined,
    business: "nga",
    source: "nga_crew_poll_vote",
    interest: `${poll.title} — ${vote}`,
    utm: {
      source: body.utm_source,
      medium: body.utm_medium,
      campaign: body.utm_campaign,
    },
    metadata: {
      poll_slug: poll.slug,
      poll_title: poll.title,
      child_first_name: childFirstName,
      child_age: childAge,
      child_level: childLevel,
      vote,
      is_parent: true,
    },
  });

  return NextResponse.json({ success: true });
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
