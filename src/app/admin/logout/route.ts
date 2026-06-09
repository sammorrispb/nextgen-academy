import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_OPTIONS, ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST (form submit) → clear the admin session cookie and return to login. */
export async function POST(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  const res = NextResponse.redirect(url, { status: 303 });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", { ...ADMIN_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
