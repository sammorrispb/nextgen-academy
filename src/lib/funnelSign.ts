import { createHmac } from "node:crypto";

export type SignParams = {
  timestamp: string;
  siteId: string;
  eventType: string;
  visitorId: string;
  email: string;
  marketingRef: string;
};

export function signFunnelPayload(secret: string, params: SignParams): string {
  const { timestamp, siteId, eventType, visitorId, email, marketingRef } = params;
  const signed = `v1:${timestamp}:${siteId}:${eventType}:${visitorId}:${email}:${marketingRef}`;
  return createHmac("sha256", secret).update(signed).digest("hex");
}
