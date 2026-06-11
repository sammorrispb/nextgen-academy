import { NextRequest, NextResponse } from "next/server";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_COOKIE_OPTIONS,
  createAdminSessionValue,
  verifyAdminMagicLinkToken,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const email = verifyAdminMagicLinkToken(token);

  if (!email || !isAllowedAdminEmail(email)) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("error", email ? "not_authorized" : "expired");
    url.searchParams.delete("token");
    return NextResponse.redirect(url);
  }

  const url = req.nextUrl.clone();
  url.pathname = "/admin/sessions";
  url.search = "";
  const res = NextResponse.redirect(url);
  res.cookies.set(
    ADMIN_SESSION_COOKIE,
    createAdminSessionValue(email),
    ADMIN_COOKIE_OPTIONS,
  );
  return res;
}
