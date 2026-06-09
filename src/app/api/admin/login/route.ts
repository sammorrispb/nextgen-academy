import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_OPTIONS,
  ADMIN_SESSION_COOKIE,
  checkAdminPassword,
  createAdminSessionValue,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { password } → set the signed admin session cookie on success. */
export async function POST(req: NextRequest) {
  let password = "";
  try {
    const body = (await req.json()) as { password?: string };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  if (!password || !checkAdminPassword(password)) {
    return NextResponse.json({ ok: false, error: "Incorrect password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionValue(), ADMIN_COOKIE_OPTIONS);
  return res;
}

/** DELETE → clear the session cookie (sign out). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", { ...ADMIN_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
