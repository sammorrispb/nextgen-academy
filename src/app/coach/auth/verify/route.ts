import { NextRequest, NextResponse } from "next/server";
import { isAllowedCoachEmail } from "@/lib/coach-allowlist";
import {
  COACH_SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionCookieValue,
  verifyMagicLinkToken,
} from "@/lib/coach-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const email = verifyMagicLinkToken(token);

  if (!email || !isAllowedCoachEmail(email)) {
    const url = req.nextUrl.clone();
    url.pathname = "/coach/login";
    url.searchParams.set("error", "expired");
    url.searchParams.delete("token");
    return NextResponse.redirect(url);
  }

  const url = req.nextUrl.clone();
  url.pathname = "/coach";
  url.search = "";
  const res = NextResponse.redirect(url);
  res.cookies.set(
    COACH_SESSION_COOKIE,
    createSessionCookieValue(email),
    SESSION_COOKIE_OPTIONS,
  );
  return res;
}
