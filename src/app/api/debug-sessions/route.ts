import { NextResponse } from "next/server";
import { fetchFreeTrialSessions, fetchNextGenEvents, hasCredentials, LOCATIONS } from "@/lib/courtreserve";

export async function GET() {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 60);
  const startStr = today.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  // Raw events from CR
  const rawResults: Record<string, unknown> = {};
  for (const loc of LOCATIONS) {
    try {
      const events = await fetchNextGenEvents(loc, startStr, endStr);
      rawResults[loc.location] = {
        count: events.length,
        sample: events.slice(0, 5).map((e) => ({
          Id: e.Id,
          EventName: e.EventName,
          Category: e.EventCategoryName,
          Start: e.StartDateTime,
          nameHasRedOrange: /\b(red|orange)\b/i.test(e.EventName),
        })),
      };
    } catch (err) {
      rawResults[loc.location] = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  // Processed free trial sessions
  let sessions: unknown[] = [];
  let error: string | null = null;
  try {
    sessions = await fetchFreeTrialSessions();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    hasCredentials: hasCredentials(),
    dateRange: { start: startStr, end: endStr },
    rawEvents: rawResults,
    freeTrialSessions: { count: sessions.length, sample: sessions.slice(0, 3) },
    error,
  });
}
