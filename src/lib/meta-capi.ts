/**
 * Meta Conversions API (CAPI) server-side event sender.
 *
 * Fires a server-side `Lead` event to Meta alongside the browser Pixel event.
 * Meta dedups client + server events when they share the same `event_id`.
 *
 * Required env vars (both must be set, otherwise this is a no-op):
 *   NEXT_PUBLIC_FB_PIXEL_ID   — same Pixel ID used by the browser snippet
 *   META_CAPI_ACCESS_TOKEN    — system user access token for the Pixel
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import { createHash } from "crypto";

export interface CAPILeadInput {
  email: string | null;
  phone: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  eventId: string;
  eventSourceUrl: string;
  clientIp: string;
  userAgent: string;
  fbp?: string;
  fbc?: string;
  /** Optional — include for test events so they show up in Events Manager test tab */
  testEventCode?: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Normalize US phone to E.164-style digits (11 digits, leading 1). */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

/**
 * Fire-and-forget `Lead` event to Meta CAPI. Errors are logged and swallowed —
 * never throws, never blocks the caller's response.
 */
export async function sendMetaLead(input: CAPILeadInput): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.warn("[meta-capi] skipped — NEXT_PUBLIC_FB_PIXEL_ID or META_CAPI_ACCESS_TOKEN missing");
    return;
  }

  const userData: Record<string, string | string[]> = {};
  if (input.email) userData.em = [sha256(input.email)];
  if (input.phone) userData.ph = [sha256(normalizePhone(input.phone))];
  if (input.firstName) userData.fn = [sha256(input.firstName)];
  if (input.lastName) userData.ln = [sha256(input.lastName)];
  if (input.city) userData.ct = [sha256(input.city)];
  if (input.state) userData.st = [sha256(input.state)];
  if (input.clientIp && input.clientIp !== "unknown") {
    userData.client_ip_address = input.clientIp;
  }
  if (input.userAgent) userData.client_user_agent = input.userAgent;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.eventSourceUrl,
        user_data: userData,
        custom_data: {
          content_name: "Free Evaluation",
          content_category: "youth_pickleball",
          value: 0,
          currency: "USD",
        },
      },
    ],
  };

  if (input.testEventCode) {
    payload.test_event_code = input.testEventCode;
  }

  try {
    const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[meta-capi] ${res.status}: ${text}`);
      return;
    }

    const data = await res.json().catch(() => null);
    if (data?.events_received !== 1) {
      console.warn("[meta-capi] unexpected response:", data);
    }
  } catch (err) {
    console.error("[meta-capi] request failed:", err);
  }
}
