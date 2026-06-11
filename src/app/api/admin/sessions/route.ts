import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionEmail } from "@/lib/admin-auth";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";
import {
  listUpcomingSessions,
  updateSession,
  type SessionPatch,
} from "@/lib/notion-sessions-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authed(): Promise<boolean> {
  const c = await cookies();
  const email = verifyAdminSessionEmail(c.get(ADMIN_SESSION_COOKIE)?.value);
  return !!email && isAllowedAdminEmail(email);
}

export async function GET() {
  if (!(await authed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ sessions: await listUpcomingSessions() });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await authed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { id?: string; patch?: SessionPatch };
  try {
    body = (await req.json()) as { id?: string; patch?: SessionPatch };
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body.id || !body.patch || typeof body.patch !== "object") {
    return NextResponse.json({ error: "id and patch are required" }, { status: 400 });
  }
  try {
    const session = await updateSession(body.id, body.patch);
    return NextResponse.json({ ok: true, session });
  } catch (e) {
    // Validation + Notion errors surface as 400 so the editor can show the message.
    return NextResponse.json({ ok: false, error: String((e as Error).message || e) }, { status: 400 });
  }
}
