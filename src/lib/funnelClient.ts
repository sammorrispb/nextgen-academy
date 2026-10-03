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
  newsletter_signup_started: {
    interest?: string;
    page?: string;
  };
  newsletter_signup_submitted: {
    interest?: string;
    page?: string;
  };
  eval_book_started: {
    interest?: string;
    page?: string;
  };
  eval_book_submitted: {
    interest?: string;
    page?: string;
  };
  crew_interest_started: {
    interest?: string;
    page?: string;
  };
  crew_interest_submitted: {
    interest?: string;
    page?: string;
  };
  fall_interest_started: {
    interest?: string;
    page?: string;
  };
  fall_interest_submitted: {
    interest?: string;
    page?: string;
  };
  league_interest_started: {
    interest?: string;
    page?: string;
  };
  league_interest_submitted: {
    interest?: string;
    page?: string;
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
  utm_content?: string;
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
 * Capture utm_source / utm_campaign / utm_medium / utm_content / ref from the current URL
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
  const utmContent = params.get("utm_content");
  const ref = params.get("ref");
  if (utmSource) fromUrl.utm_source = utmSource;
  if (utmCampaign) fromUrl.utm_campaign = utmCampaign;
  if (utmMedium) fromUrl.utm_medium = utmMedium;
  if (utmContent) fromUrl.utm_content = utmContent;
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

  // Callers are typed, but runtime inputs must not become arbitrary provider
  // event names (or accidentally expand the third-party field contract).
  if (!MIRRORED_EVENTS.has(name) || !props || typeof props !== "object" || Array.isArray(props)) return;

  try {
    let visitorId: string;
    try {
      visitorId = getOrCreateVisitorId();
    } catch {
      // Blocked/malformed cookies must not prevent transport. This id is
      // request-local; no persistence is claimed when cookies are unavailable.
      visitorId = generateVisitorId();
    }
    const body = JSON.stringify({
      event_name: name,
      props: { ...props, visitor_id: visitorId, business: BUSINESS, ...getUtm() },
      page: window.location ? window.location.pathname : undefined,
    });

    let accepted = false;
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        accepted = navigator.sendBeacon(ANALYTICS_ENDPOINT, new Blob([body], { type: "application/json" }));
      } catch {
        // Fall through to the single fetch fallback.
      }
    }
    if (!accepted) {
      void fetch(ANALYTICS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => { /* analytics must never break the page */ });
    }
  } catch {
    /* First-party failure must not suppress the independent safe mirrors. */
  }
  mirrorToThirdParty(name);
}

// Explicit event identifiers only. Do not derive provider parameters from
// caller props: labels, interests, URLs and nested fields can contain PII.
const MIRRORED_EVENTS = new Set<keyof AnalyticsEventMap>([
  "page_view", "cta_click", "lead_form", "lead_form_started", "lead_form_submitted",
  "yellowball_lead_submitted", "waitlist_submitted", "newsletter_signup_started",
  "newsletter_signup_submitted", "eval_book_started", "eval_book_submitted",
  "crew_interest_started", "crew_interest_submitted", "fall_interest_started",
  "fall_interest_submitted", "league_interest_started", "league_interest_submitted",
  "external_link", "scroll_depth", "free_trial_rsvp",
]);

/** Optional, coarse conversion mirrors; loading/enabling tags stays in Analytics. */
function mirrorToThirdParty(name: keyof AnalyticsEventMap): void {
  if (typeof window === "undefined") return;
  // Analytics owns provider page views. YellowBallInquiryForm emits both the
  // canonical lead and this legacy alias; retain both in OB, count one lead here.
  if (name === "page_view" || name === "yellowball_lead_submitted") return;
  const isLead = name.endsWith("_submitted");
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", isLead ? "generate_lead" : name, { content_name: name });
    }
  } catch {
    /* Google failure must not suppress Meta or interrupt navigation. */
  }
  try {
    if (typeof window.fbq === "function") {
      window.fbq(isLead ? "track" : "trackCustom", isLead ? "Lead" : name, { content_name: name });
    }
  } catch {
    /* analytics must never break the page */
  }
}
