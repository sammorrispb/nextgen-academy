/**
 * Open Brain lead ingest client.
 *
 * Fire-and-forget POST to the Open Brain leads-ingest Edge Function.
 * Any failure is logged but does not affect the caller's response.
 *
 * Required env vars:
 *   OPEN_BRAIN_INGEST_URL    — full URL to the edge function
 *   LEAD_INGEST_TOKEN        — shared secret
 */

export type OpenBrainBusiness = "ld" | "nga" | "coaching" | "dd" | "mocopb";

// At least one of `email` or `phone` is required (server-side enforced).
export interface OpenBrainIngestPayload {
  email?: string;
  name?: string;
  phone?: string;
  business: OpenBrainBusiness;
  source: string;
  initial_stage?: string;
  utm?: { campaign?: string; source?: string; medium?: string };
  interest?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget ingest. Returns a promise that always resolves — errors
 * are logged but never thrown. Callers should not await this if they want
 * truly non-blocking behavior.
 */
export async function ingestToOpenBrain(
  payload: OpenBrainIngestPayload
): Promise<void> {
  const url = process.env.OPEN_BRAIN_INGEST_URL;
  const token = process.env.LEAD_INGEST_TOKEN;

  if (!url || !token) {
    console.warn("[OB ingest] skipped — env vars missing");
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lead-ingest-token": token,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[OB ingest] ${res.status}: ${text}`);
      return;
    }
  } catch (err) {
    console.error("[OB ingest] request failed:", err);
  }
}
