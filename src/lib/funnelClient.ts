"use client";

/**
 * Client-side analytics + visitor-id + UTM capture for NGA.
 *
 * Events are POSTed to the same-origin /api/analytics proxy, which forwards
 * to the Open Brain analytics-ingest edge function with the shared token
 * server-side. Failures never throw — analytics must never break the page.
 */

export type AnalyticsEventMap = {
  page_view: {
    referrer?: string;
  };
  cta_click: {
    label: string;
    page?: string;
    section?: string;
    destination?: string;
  };
  /** Legacy multi-action event kept for back-compat with existing call sites. */
  lead_form: {
    action: "started" | "submitted" | "error";
    interest?: string;
    page: string;
  };
  lead_form_started: {
    interest?: string;
    page?: string;
  };
  lead_form_submitted: {
    interest?: string;
    page?: string;
  };
  yellowball_lead_submitted: {
    child_age?: number;
    parent_name?: string;
    source: string;
  };
  waitlist_submitted: {
    preferredArea: string;
    marketingOptIn: boolean;
    source: string;
  };
  external_link: {
    label: string;
    url: string;
    page?: string;
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
const UTM_STORAGE_KEY = "ld_utm";
const BUSINESS = "nga" as const;
const ANALYTICS_ENDPOINT = "/api/analytics";

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
 * Form-payload friendly visitor id accessor. Returns "" during SSR so the
 * caller can spread it into a request body unconditionally.
 */
export function getVisitorIdForForm(): string {
  if (typeof document === "undefined") return "";
  return getOrCreateVisitorId();
}

/* ------------------------------ UTM capture ------------------------------ */

export type CapturedUtm = {
  utm_source?: string;
  utm_campaign?: string;
  utm_medium?: string;
  ref?: string;
};

function readSessionUtm(): CapturedUtm {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as CapturedUtm)
      : {};
  } catch {
    return {};
  }
}

function writeSessionUtm(utm: CapturedUtm): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  } catch {
    // sessionStorage unavailable (privacy mode) — silent no-op.
  }
}

/**
 * Capture utm_source / utm_campaign / utm_medium / ref from the current URL
 * into sessionStorage on first landing. Idempotent — non-empty params merge
 * onto an existing stash so a later campaign click can refine attribution.
 */
export function captureUtm(): void {
  if (typeof window === "undefined") return;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return;
  }

  const fromUrl: CapturedUtm = {};
  const utmSource = params.get("utm_source");
  const utmCampaign = params.get("utm_campaign");
  const utmMedium = params.get("utm_medium");
  const ref = params.get("ref");
  if (utmSource) fromUrl.utm_source = utmSource;
  if (utmCampaign) fromUrl.utm_campaign = utmCampaign;
  if (utmMedium) fromUrl.utm_medium = utmMedium;
  if (ref) fromUrl.ref = ref;

  if (Object.keys(fromUrl).length === 0) return;

  const existing = readSessionUtm();
  const merged: CapturedUtm = { ...existing, ...fromUrl };
  writeSessionUtm(merged);
}

/** Returns the stashed UTM object (or {} if none / SSR). */
export function getUtm(): CapturedUtm {
  return readSessionUtm();
}

/* ------------------------------ trackEvent ------------------------------- */

/**
 * Fire-and-forget analytics POST. Always resolves; failures never throw.
 *
 * Routes through /api/analytics so the OB ingest token stays server-side.
 * Uses sendBeacon when available (so events fire reliably during navigation
 * / page unload), else falls back to fetch with keepalive.
 *
 * The server proxy enriches props with `visitor_id`, `business: 'nga'`, and
 * any active UTM fields — but we set them client-side too so the request
 * body carries everything in one place (defense in depth).
 */
export function trackEvent<K extends keyof AnalyticsEventMap>(
  name: K,
  props: AnalyticsEventMap[K],
  // Kept for back-compat with familyMarketingRef call sites in Footer.tsx.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _marketingRefOverride?: string,
): void {
  if (typeof window === "undefined") return;

  try {
    const visitorId = getOrCreateVisitorId();
    const utm = getUtm();
    const page = window.location ? window.location.pathname : undefined;

    const body = JSON.stringify({
      event_name: name,
      props: {
        ...props,
        visitor_id: visitorId,
        business: BUSINESS,
        ...utm,
      },
      page,
    });

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      try {
        const blob = new Blob([body], { type: "application/json" });
        const ok = navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
        if (ok) return;
      } catch {
        // fall through to fetch
      }
    }

    void fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* swallow — analytics must never break the page */
    });
  } catch {
    /* swallow — analytics must never break the page */
  }
}
