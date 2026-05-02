"use client";

export type AnalyticsEventMap = {
  cta_click: {
    label: string;
    page: string;
    section: string;
    destination?: string;
  };
  lead_form: {
    action: "started" | "submitted" | "error";
    interest?: string;
    page: string;
  };
  lead_submitted: {
    interest?: string;
    page: string;
    location?: string;
  };
  yellowball_lead_submitted: {
    child_age?: number;
    parent_name?: string;
    source: string;
  };
  external_link: {
    label: string;
    url: string;
    page: string;
  };
  scroll_depth: {
    depth: 25 | 50 | 75 | 100;
    page: string;
  };
  free_trial_rsvp: {
    location: string;
    session_id: string;
  };
};

const VISITOR_COOKIE = "ld_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;

function generateVisitorId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const pair = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${VISITOR_MAX_AGE}; Path=/; SameSite=Lax`;
}

export function getOrCreateVisitorId(): string {
  const existing = readCookie(VISITOR_COOKIE);
  if (existing) return existing;
  const id = generateVisitorId();
  writeCookie(VISITOR_COOKIE, id);
  return id;
}

/**
 * Get the current visitor_id for inclusion in a form submission payload.
 * Safe to call during client render; returns empty string if run outside
 * a browser (SSR), so it can be spread into request bodies unconditionally.
 */
export function getVisitorIdForForm(): string {
  if (typeof document === "undefined") return "";
  return getOrCreateVisitorId();
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export function trackEvent<K extends keyof AnalyticsEventMap>(
  name: K,
  props: AnalyticsEventMap[K],
  marketingRefOverride?: string,
): void {
  // No-op: Hub funnel ingest decommissioned 2026-05-02.
  return;
}
/* eslint-enable @typescript-eslint/no-unused-vars */
