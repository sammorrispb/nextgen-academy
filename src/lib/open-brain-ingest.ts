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

export type OpenBrainBusiness = "ld" | "nga" | "coaching" | "dd";

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

// Sam's call (2026-08-30, recorded in open-brain supabase/functions/
// nga-crm-sync/index.ts): Open Brain may hold a child's FIRST name and age —
// nothing further. Enforced here because 27 call sites feed this helper and the
// Stripe-webhook ones run inside after(), where no spec can watch the payload.
// Keys are matched anywhere in the metadata tree; a match drops the whole value.
const FORBIDDEN_CHILD_KEY =
  /birth|(^|_)dob$|last_?name|surname|allerg|emergenc|school|medical/i;
// Child-name fields keep only their first word (forms take a full name).
const CHILD_NAME_KEY = /^(child_name|child_first_name|nga_child_first_name)$/;

function firstWord(value: unknown): unknown {
  return typeof value === "string" ? value.trim().split(/\s+/)[0] ?? "" : value;
}

function capChildFields(value: unknown, stripped: Set<string>, parentKey = ""): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => capChildFields(item, stripped, parentKey));
  }
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_CHILD_KEY.test(key)) {
      stripped.add(key);
      continue;
    }
    if (CHILD_NAME_KEY.test(key) || (parentKey === "kids" && key === "name")) {
      out[key] = firstWord(inner);
      continue;
    }
    out[key] = capChildFields(inner, stripped, key);
  }
  return out;
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

  const stripped = new Set<string>();
  const safePayload: OpenBrainIngestPayload = payload.metadata
    ? {
        ...payload,
        metadata: capChildFields(payload.metadata, stripped) as Record<string, unknown>,
      }
    : payload;
  if (stripped.size) {
    // Key names only — never values.
    console.warn(`[OB ingest] ${payload.source}: dropped child fields ${[...stripped].sort().join(",")}`);
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lead-ingest-token": token,
      },
      body: JSON.stringify(safePayload),
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
