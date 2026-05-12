import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { isAllowedCoachEmail } from "@/lib/coach-allowlist";
import { createMagicLinkToken } from "@/lib/coach-auth";

export const runtime = "nodejs";

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

function siteOrigin(req: NextRequest): string {
  return (
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://www.nextgenpbacademy.com"
  );
}

export async function POST(req: NextRequest) {
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
  if (!isAllowedCoachEmail(email)) {
    return NextResponse.json({ ok: true });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[coach-request-link] RESEND_API_KEY missing");
    return NextResponse.json({ error: "Email not configured" }, { status: 500 });
  }

  const token = createMagicLinkToken(email);
  const link = `${siteOrigin(req)}/coach/auth/verify?token=${encodeURIComponent(token)}`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Sign in to the NGA coach dashboard",
    text: [
      "Click the link below to sign in to the NGA coach dashboard.",
      "",
      link,
      "",
      "This link is good for 10 minutes. If you didn't request it, ignore this email.",
    ].join("\n"),
  });
  if (error) {
    console.error("[coach-request-link] Resend rejected", error);
    return NextResponse.json({ error: "Could not send" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
