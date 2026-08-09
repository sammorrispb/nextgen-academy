import { NextRequest } from "next/server";
import {
  verifyLeadConsentToken,
  type ConsentAction,
} from "@/lib/lead-consent-token";
import { quarantineLeadByEmail } from "@/lib/notion-lead-quarantine";
import { unsubscribeByEmail } from "@/lib/notion-newsletter";
import { subscribeLeadByEmail } from "@/lib/notion-newsletter-optin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-click consent capture for the lead-CRM permission pass.
 *
 * `action=subscribe` — the family said yes to future updates. Creates (or
 * reactivates) their Newsletter Subscribers row with Marketing Opt-In set.
 * `action=optout`    — the family said stop. Ticks Quarantine on EVERY CRM row
 * they own AND flips any subscriber row to Unsubscribed, so neither the lead
 * blasts nor the weekly newsletter can reach them again.
 *
 * The action is signed into the token (see lead-consent-token), so the query
 * param cannot be edited to flip one choice into the other.
 *
 * GET, not POST, because it is a link in an email. That means mail-scanner
 * prefetch can fire it — acceptable here because both actions are idempotent
 * and both are recorded choices the parent can reverse by replying. The opt-out
 * is the safe direction to be accidentally triggered; the opt-in only ever adds
 * someone who was already being mailed.
 */

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
    <a href="https://nextgenpbacademy.com" style="display:inline-block;background:#AADC00;color:#05132B;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Back to Next Gen</a>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function parseAction(raw: string | null): ConsentAction | null {
  return raw === "subscribe" || raw === "optout" ? raw : null;
}

export async function GET(req: NextRequest) {
  const action = parseAction(req.nextUrl.searchParams.get("action"));
  const token = req.nextUrl.searchParams.get("token") ?? "";

  if (!action) {
    return page(
      "Link not valid",
      "This link is missing or has an unrecognised action. Reply to any of our emails and we'll sort it out by hand.",
    );
  }

  const email = token ? verifyLeadConsentToken(token, action) : null;
  if (!email) {
    return page(
      "Link not valid",
      "This link is invalid, incomplete, or was meant for a different action. Reply &ldquo;skip&rdquo; to any of our emails and we'll take you off the list by hand.",
    );
  }

  if (action === "optout") {
    // Both stores, always. Quarantine covers the lead blasts; the subscriber
    // flip covers the weekly newsletter. Someone asking to stop means both.
    const [quarantine, newsletter] = await Promise.all([
      quarantineLeadByEmail(email),
      unsubscribeByEmail(email).catch(() => false),
    ]);

    if (!quarantine.ok && !newsletter) {
      return page(
        "We couldn't complete that",
        "Something went wrong on our end and we don't want to tell you you're off the list if you aren't. Please reply &ldquo;skip&rdquo; to any of our emails and Coach Sam will remove you by hand.",
      );
    }

    return page(
      "You're off the list",
      "You won't hear from Next Gen again &mdash; not the newsletter, not camp emails. No hard feelings, and the courts are always here if you change your mind.",
    );
  }

  const result = await subscribeLeadByEmail(email);
  if (!result.ok) {
    return page(
      "We couldn't save that",
      "Something went wrong on our end. Please sign up at <a href=\"https://nextgenpbacademy.com/newsletter\" style=\"color:#AADC00;\">nextgenpbacademy.com/newsletter</a> and you'll be all set.",
    );
  }

  return page(
    result.alreadyActive ? "You're already in" : "You're in the crew",
    result.alreadyActive
      ? "You were already on the list &mdash; nothing to change. You'll keep getting the Thursday note with open sessions and a coach tip."
      : "Thanks &mdash; you'll get the Thursday note with open sessions, a coach tip, and what's coming up. Every issue has a one-click unsubscribe if you change your mind.",
  );
}
