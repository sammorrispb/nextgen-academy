import { NextRequest } from "next/server";
import {
  isFallPollAction,
  verifyFallPollToken,
  type FallPollAction,
} from "@/lib/fall-poll-token";
import { recordFallPollResponse } from "@/lib/notion-fall-poll";
import { sendFallRegistrationLink } from "@/lib/fall-reg-link-run";
import {
  FALL_POLL_DAY_LABEL,
  FALL_POLL_SEASON_LABEL,
  FALL_POLL_VENUE,
} from "@/data/fall-poll-2026";
import { FALL_POLL_GROUPS_LINE } from "@/lib/email/fall-poll-invite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-click Fall 2026 poll capture — with a confirm step.
 *
 * GET renders a confirmation page (no write), POST records the answer. This
 * deliberately departs from lead-consent's record-on-GET: consent actions are
 * both safe directions, but a poll answer allocates one of 8 paid spots, and
 * mail scanners prefetch every link in an email — a scanner walking IN /
 * INTERESTED / OUT would cast a random vote. Scanners follow links; they
 * don't submit forms. The parent cost is one extra tap.
 *
 * Re-answering is allowed and desired (latest confirmed tap wins) — the email
 * says so.
 */

const ANSWER_LABEL: Record<FallPollAction, string> = {
  in: "IN — count us in",
  interested: "INTERESTED — tell me more",
  out: "OUT — not this season",
};

function page(title: string, body: string, extra = ""): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title} — Next Gen Pickleball Academy</title>
</head>
<body style="margin:0;padding:0;background:#05132B;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:64px 24px;text-align:center;color:#EEF2FF;">
    <h1 style="font-family:Montserrat,Arial,sans-serif;color:#AADC00;font-size:24px;margin:0 0 12px 0;">${title}</h1>
    <p style="font-size:15px;line-height:1.6;color:#EEF2FF;margin:0 0 24px 0;">${body}</p>
    ${extra}
    <p style="margin:24px 0 0 0;"><a href="https://nextgenpbacademy.com" style="color:#7A88B8;font-size:13px;">nextgenpbacademy.com</a></p>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function invalidLinkPage(): Response {
  return page(
    "Link not valid",
    "This link is invalid or incomplete. No problem &mdash; just reply to the season email with IN, INTERESTED, or OUT and Coach Sam will record it by hand.",
  );
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");
  const token = req.nextUrl.searchParams.get("token") ?? "";

  if (!isFallPollAction(action) || !verifyFallPollToken(token, action)) {
    return invalidLinkPage();
  }

  return page(
    "One tap to confirm",
    `You&rsquo;re answering <strong style="color:#AADC00;">${ANSWER_LABEL[action]}</strong>
     for the fall season &mdash; ${FALL_POLL_DAY_LABEL} at ${FALL_POLL_VENUE},
     ${FALL_POLL_SEASON_LABEL} (${FALL_POLL_GROUPS_LINE}).<br><br>
     Changed your mind? Just close this page and tap a different answer in the email.`,
    `<form method="POST" action="/api/fall-poll">
       <input type="hidden" name="action" value="${action}">
       <input type="hidden" name="token" value="${escapeAttr(token)}">
       <button type="submit" style="background:#AADC00;color:#05132B;padding:14px 32px;border-radius:8px;border:0;font-weight:700;font-size:16px;cursor:pointer;">Confirm my answer</button>
     </form>`,
  );
}

export async function POST(req: NextRequest) {
  let action: string | null = null;
  let token = "";
  try {
    const form = await req.formData();
    action = String(form.get("action") ?? "");
    token = String(form.get("token") ?? "");
  } catch {
    return invalidLinkPage();
  }

  if (!isFallPollAction(action)) return invalidLinkPage();
  const email = verifyFallPollToken(token, action);
  if (!email) return invalidLinkPage();

  const result = await recordFallPollResponse(email, action);

  // Close the handoff the confirmation copy promises. Only a transition INTO
  // "in" earns the link: a re-tap of the same answer (prior === "in") mails
  // nothing, which is what keeps a second device or a re-opened email from
  // double-mailing. Best-effort and non-blocking on purpose — the answer is
  // already recorded, so a Resend blip must not tell the parent we failed.
  if (result.ok && !result.notFound && action === "in" && result.previous !== "in") {
    const firstName = (result.parentName ?? "").trim().split(/\s+/)[0] || "there";
    const sent = await sendFallRegistrationLink(email, firstName);
    if (!sent) {
      console.error(
        `[fall-poll] recorded IN for ${email} but the registration link did NOT send — follow up by hand`,
      );
    }
  }

  if (result.notFound) {
    return page(
      "We couldn't match your family",
      "This link checks out, but we couldn&rsquo;t find your family on file. Just reply to the season email with your answer and Coach Sam will record it by hand.",
    );
  }
  if (!result.ok) {
    return page(
      "We couldn't save that",
      "Something went wrong on our end and we don&rsquo;t want to show you a confirmation that isn&rsquo;t real. Please reply to the season email with your answer &mdash; Coach Sam will record it by hand.",
    );
  }

  if (action === "in") {
    return page(
      "You're in! 🎉",
      `We&rsquo;ve marked your family <strong style="color:#AADC00;">IN</strong> for the fall season
       &mdash; ${FALL_POLL_DAY_LABEL} at ${FALL_POLL_VENUE}, ${FALL_POLL_SEASON_LABEL}.
       Nothing has been charged: Coach Sam will follow up with payment details to lock your
       spot, and spots are first come, first serve.`,
    );
  }
  if (action === "interested") {
    return page(
      "Got it — you're interested",
      "We&rsquo;ve marked you down as interested. Coach Sam will follow up with the details so you can decide &mdash; no commitment yet, and you can switch to IN any time from the email.",
    );
  }
  return page(
    "No problem — see you around",
    "We&rsquo;ve marked you out for the fall season. No hard feelings &mdash; drop-ins and evals keep running, and the courts are always here when the timing works.",
  );
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
