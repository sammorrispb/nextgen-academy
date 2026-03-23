import { NextResponse } from "next/server";
import { fetchFreeTrialSessions, hasCredentials, LOCATIONS } from "@/lib/courtreserve";

export async function GET() {
  const creds: Record<string, boolean> = {};
  for (const loc of LOCATIONS) {
    const prefix = `COURTRESERVE_${loc.key.toUpperCase()}_`;
    creds[`${loc.location}_USERNAME`] = !!process.env[`${prefix}USERNAME`];
    creds[`${loc.location}_PASSWORD`] = !!process.env[`${prefix}PASSWORD`];
    creds[`${loc.location}_ORG_ID`] = !!process.env[`${prefix}ORG_ID`];
  }

  let sessions: unknown[] = [];
  let error: string | null = null;
  try {
    sessions = await fetchFreeTrialSessions();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    hasCredentials: hasCredentials(),
    creds,
    sessionCount: sessions.length,
    sessions: sessions.slice(0, 3),
    error,
  });
}
