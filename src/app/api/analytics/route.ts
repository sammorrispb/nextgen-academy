import { NextResponse } from "next/server";

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

  const url = process.env.OPEN_BRAIN_ANALYTICS_URL;
  const token = process.env.LEAD_INGEST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[analytics] skipped — env vars missing");
    }
    return new NextResponse(null, { status: 204 });
  }

  // Fire-and-forget — return immediately, don't block the page on a slow
  // ingest. We still log non-2xx responses for debugging.
  void (async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lead-ingest-token": token,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`[analytics] ${res.status}: ${text}`);
      }
    } catch (err) {
      console.error("[analytics] request failed:", err);
    }
  })();

  return new NextResponse(null, { status: 204 });
}
