import { NextRequest, NextResponse } from "next/server";
import { COACH_SESSION_COOKIE } from "@/lib/coach-auth";

export const runtime = "nodejs";

function clearAndRedirect(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/coach/login";
  url.search = "";
  const res = NextResponse.redirect(url);
  res.cookies.set(COACH_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function POST(req: NextRequest) {
  return clearAndRedirect(req);
}

export async function GET(req: NextRequest) {
  return clearAndRedirect(req);
}
