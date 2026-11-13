import { after, NextResponse } from "next/server";
import { analyticsPayloadHasCapability, containsStandingsCapability } from "@/lib/analytics-privacy";

// Room for the forward to finish after the 204 has gone out (15s timeout below).
export const maxDuration = 30;

/**
 * Server-side proxy to the Open Brain analytics-ingest edge function.
 *
 * Keeps the ingest token out of the browser. Always returns 204 — analytics
 * failures must never block the page; they're logged server-side instead.
 *
 * Required env vars:
 *   OPEN_BRAIN_ANALYTICS_URL — full URL to the analytics-ingest edge function
 *                              (e.g. https://lfazndedomuhgcssxkrx.supabase.co/functions/v1/analytics-ingest)
 *   LEAD_INGEST_TOKEN        — shared secret (same token as leads-ingest)
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  if (analyticsPayloadHasCapability(body) || containsStandingsCapability(request.headers.get("referer"))) {
    return new NextResponse(null, { status: 204 });
  }

  const url = process.env.OPEN_BRAIN_ANALYTICS_URL;
  const token = process.env.LEAD_INGEST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[analytics] skipped — env vars missing");
    }
    return new NextResponse(null, { status: 204 });
  }

  // The forward is registered with the platform through after(), never left as
  // a detached promise. Vercel can suspend the function the moment the 204 is
  // returned, and a detached send then only finishes if a later request thaws
  // the instance. A visitor who just tapped a link that leaves the site sends
  // no later request, so those taps were the events that went missing. Do not
  // wrap after() in a try/catch: a failure to register must stay loud.
  after(async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lead-ingest-token": token,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        // Status only: the upstream body and the event payload stay out of logs.
        console.error("[analytics] upstream rejected event", { status: res.status });
      }
      await res.body?.cancel();
    } catch (err) {
      const reason = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
        ? "timeout"
        : "network";
      console.error("[analytics] forwarding failed", { reason });
    }
  });

  return new NextResponse(null, { status: 204 });
}
