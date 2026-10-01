import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeSessionOps } from "@/lib/session-ops-auth";
import { runFallCall, type FallCallRequest } from "@/lib/fall-call-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Fall 2026 weather call — cancel / on / revert a group's Sunday, or record
// a rain date's CUPF booking. Admin cookie (the /admin/weather buttons) OR
// Bearer SESSION_OPS_SECRET (an agent making the call for Sam): both fail
// closed and reach the SAME engine, so either fires the identical fan-out.
//
// Always preview first: `dryRun: true` returns the recipient list, the email,
// the WhatsApp text and the make-up date with zero writes and zero sends.

const ALLOWED_KEYS = new Set([
  "action",
  "date",
  "groups",
  "note",
  "extraEmails",
  "notify",
  "resend",
  "only",
  "cupf",
  "dryRun",
]);

const STATUS: Record<string, number> = {
  invalid: 400,
  not_configured: 503,
  resend_unconfigured: 503,
  calls_unreadable: 502,
  roster_unreadable: 502,
  write_failed: 502,
};

export async function POST(req: NextRequest) {
  if (!authorizeSessionOps(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const unknown = Object.keys(body).filter((k) => !ALLOWED_KEYS.has(k));
  if (unknown.length > 0) {
    // A typo is a 400, never a silent default — this route emails families.
    return NextResponse.json({ error: `Unknown field(s): ${unknown.join(", ")}` }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const strList = (v: unknown) =>
    Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : undefined;
  const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);

  const action = str(body.action);
  const date = str(body.date);
  if (!action || !date) {
    return NextResponse.json({ error: "action and date are required" }, { status: 400 });
  }

  const request: FallCallRequest = {
    action: action as FallCallRequest["action"],
    date,
    groups: strList(body.groups),
    note: str(body.note),
    extraEmails: strList(body.extraEmails) ?? str(body.extraEmails),
    notify: bool(body.notify),
    resend: bool(body.resend),
    only: strList(body.only),
    cupf: str(body.cupf),
    dryRun: bool(body.dryRun),
  };

  const result = await runFallCall(request);
  if (!result.ok) {
    return NextResponse.json({ error: result.message, reason: result.reason }, {
      status: STATUS[result.reason] ?? 500,
    });
  }

  if (result.written) {
    // Put the call on /fall now rather than at the next revalidate. A failure
    // here costs at most a minute of staleness, never the call itself.
    try {
      revalidatePath("/fall");
    } catch (err) {
      console.error("[fall-calls] revalidatePath failed", err);
    }
  }
  return NextResponse.json(result);
}
