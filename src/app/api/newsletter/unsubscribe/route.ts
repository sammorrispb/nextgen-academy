import { NextRequest } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/newsletter-token";
import { unsubscribeByEmail } from "@/lib/notion-newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minimal dark-theme confirmation page matching the NGA email chrome. */
function page(title: string, body: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Next Gen Pickleball Academy</title>
</head>
<body style="margin:0;padding:0;background:#05132B;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:64px 24px;text-align:center;color:#EEF2FF;">
    <h1 style="font-family:Montserrat,Arial,sans-serif;color:#AADC00;font-size:24px;margin:0 0 12px 0;">${title}</h1>
    <p style="font-size:15px;line-height:1.6;color:#EEF2FF;margin:0 0 24px 0;">${body}</p>
    <a href="https://nextgenpbacademy.com" style="display:inline-block;background:#AADC00;color:#05132B;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Back to Next Gen</a>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const email = token ? verifyUnsubscribeToken(token) : null;

  if (!email) {
    return page(
      "Link not valid",
      "This unsubscribe link is invalid or incomplete. If you'd like to stop receiving the newsletter, reply &ldquo;skip&rdquo; to any issue and we'll take you off the list.",
    );
  }

  const ok = await unsubscribeByEmail(email);
  if (!ok) {
    return page(
      "We couldn't find that address",
      "You may already be unsubscribed. If you keep receiving emails, reply &ldquo;skip&rdquo; to any issue and we'll sort it out.",
    );
  }

  return page(
    "You're unsubscribed",
    "You won't get the Next Gen newsletter anymore. No hard feelings — the courts are always here when you're ready.",
  );
}
