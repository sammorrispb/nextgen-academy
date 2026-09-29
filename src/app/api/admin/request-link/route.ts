import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { deliverCronAlert } from "@/lib/cron-alert";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { siteOrigin } from "@/lib/site-origin";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";
import { createAdminMagicLinkToken } from "@/lib/admin-auth";

export const runtime = "nodejs";

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

// Per IP, never per email: a per-email bucket would let anyone lock Sam (or a
// coach) out of sign-in by spamming their address. Checked before the
// allowlist so a 429 says nothing about which addresses are valid.
const limiter = createRateLimiter({ limit: 10 });

export async function POST(req: NextRequest) {
  if (limiter.isRateLimited(getClientIp(req))) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let email = "";
  try {
    const body = (await req.json()) as { email?: string };
    email = String(body.email ?? "")
      .toLowerCase()
      .trim();
  } catch {
    /* fall through to validation */
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Always return success to avoid leaking which emails are valid. Side-effect
  // (the email send) only happens for allowlisted addresses.
  if (!isAllowedAdminEmail(email)) {
    return NextResponse.json({ ok: true });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[admin-request-link] RESEND_API_KEY missing");
    return NextResponse.json({ error: "Email not configured" }, { status: 500 });
  }

  const token = createAdminMagicLinkToken(email);
  const link = `${siteOrigin()}/admin/auth/verify?token=${encodeURIComponent(token)}`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Sign in to NGA admin",
    text: [
      "Click the link below to sign in to the NGA admin area.",
      "",
      link,
      "",
      "This link is good for 10 minutes. If you didn't request it, ignore this email.",
    ].join("\n"),
  });
  if (error) {
    console.error("[admin-request-link] Resend rejected", error);
    // The only user of this form is Sam or a coach, and a sign-in email that
    // never arrives looks identical to one that's slow. Alert (email, then SMS
    // fallback — the likely failure is Resend itself) so it isn't a guess.
    await deliverCronAlert("admin-request-link", {
      attempted: 1,
      succeeded: 0,
      failures: [{ signature: "sign_in_email_rejected" }],
    });
    return NextResponse.json({ error: "Could not send" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
