import { signFunnelPayload } from "./funnelSign";

const HUB_ENDPOINT = "https://linkanddink.com/api/funnel-event";
export const SITE_ID = "nga" as const;
export const DEFAULT_MARKETING_REF = "nga" as const;

export type ServerEventParams = {
  eventType: string;
  visitorId?: string | null;
  email?: string | null;
  marketingRef?: string | null;
  properties?: Record<string, unknown> | null;
};

export async function sendFunnelEvent(params: ServerEventParams): Promise<void> {
  const secret = process.env.FUNNEL_INGEST_SECRET_NGA;
  if (!secret) {
    console.warn("[funnel] FUNNEL_INGEST_SECRET_NGA not set — skipping");
    return;
  }

  const email = params.email ? params.email.trim().toLowerCase() : "";
  const visitorId = params.visitorId ?? "";
  const marketingRef = params.marketingRef || DEFAULT_MARKETING_REF;
  const timestamp = Date.now().toString();
  const signature = signFunnelPayload(secret, {
    timestamp,
    siteId: SITE_ID,
    eventType: params.eventType,
    visitorId,
    email,
    marketingRef,
  });

  try {
    const res = await fetch(HUB_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-funnel-signature": `t=${timestamp},s=${signature}`,
      },
      body: JSON.stringify({
        site_id: SITE_ID,
        event_type: params.eventType,
        visitor_id: visitorId || null,
        email: email || null,
        marketing_ref: marketingRef,
        properties: params.properties ?? null,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[funnel] ingest failed ${res.status}: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.error("[funnel] ingest error:", err);
  }
}
