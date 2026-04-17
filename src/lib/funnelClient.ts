"use client";

import { getRefSource } from "./urls";

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

export function trackEvent<K extends keyof AnalyticsEventMap>(
  name: K,
  props: AnalyticsEventMap[K],
): void {
  if (typeof window === "undefined") return;
  const visitorId = getOrCreateVisitorId();
  const page_url = window.location.href;
  const marketing_ref = getRefSource(window.location.pathname);
  const body = JSON.stringify({
    event_type: name,
    visitor_id: visitorId,
    marketing_ref,
    properties: { ...props, page_url },
  });
  try {
    void fetch("/api/funnel-track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body,
    }).catch(() => {});
  } catch {
    // Never block UI on tracking failure.
  }
}
