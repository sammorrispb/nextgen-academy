// Shared SEO helpers used across pages so JSON-LD stays consistent.
// Keeps the address + areaServed list in ONE place — change here, every page
// (homepage, location landers, etc.) picks it up.

import type { BlogPost } from "@/data/blog";

export const SITE_URL = "https://nextgenpbacademy.com" as const;

/**
 * MoCo cities the academy actively serves. Order matters — used as
 * `areaServed` in LocalBusiness / SportsActivityLocation schema.
 */
export const SERVICE_AREAS = [
  "Bethesda",
  "North Bethesda",
  "Rockville",
  "Potomac",
  "Gaithersburg",
  "Germantown",
  "Chevy Chase",
  "Olney",
  "Silver Spring",
] as const;

export type ServiceCity = (typeof SERVICE_AREAS)[number];

/**
 * Areas served OUTSIDE Montgomery County, where NGA coaches at a named partner
 * venue. Separate from SERVICE_AREAS on purpose (Sam, 2026-09-07).
 *
 * Frederick joined when NGA began coaching the Saturday leagues at The Pickl
 * Park, and GRADUATED to its own landing page on 2026-09-13 (AEO audit, Sam's
 * call): an out-of-county area graduates by gaining a `slug` here. The footer's
 * "Areas We Serve" block and the sitemap read EXTENDED_AREA_LANDING_PAGES.
 *
 * It still never enters SERVICE_AREAS. That list is the MoCo city ladder that
 * drives the per-city "nearby areas" cross-links, the cluster map (every entry
 * must map to a MoCo cluster — e2e/clusters.spec.ts), and CityLanding's
 * `ServiceCity` prop. Listing Frederick as "nearby" to Bethesda would be a lie
 * that dilutes nine tuned local-SEO pages.
 *
 * `nearbyTowns` are the Frederick County towns the landing page names for
 * families driving in. They are areaServed claims only — never "families from
 * Urbana train with us" (zero Frederick families are in the CRM).
 */
export interface ExtendedServiceArea {
  county: string;
  city: string;
  slug: string;
  nearbyTowns: readonly string[];
  /** MoCo city pages that sit between the two venues and cross-link here. */
  crossLinkCities: readonly ServiceCity[];
}

export const EXTENDED_SERVICE_AREAS: readonly ExtendedServiceArea[] = [
  {
    county: "Frederick County, MD",
    city: "Frederick",
    slug: "youth-pickleball-frederick",
    nearbyTowns: [
      "Urbana",
      "New Market",
      "Mount Airy",
      "Middletown",
      "Walkersville",
      "Brunswick",
    ],
    crossLinkCities: ["Germantown"],
  },
];

/** Out-of-county landing pages — sitemap + footer, alongside CITY_LANDING_PAGES. */
export const EXTENDED_AREA_LANDING_PAGES: { city: string; slug: string }[] =
  EXTENDED_SERVICE_AREAS.map(({ city, slug }) => ({ city, slug }));

/**
 * The live city landing pages (subset of SERVICE_AREAS with a dedicated
 * route). ONE source of truth for the sitemap, the footer "Areas we serve"
 * block, and the per-city "nearby areas" links — a new city page ships by
 * adding a row here plus its page file.
 */
export const CITY_LANDING_PAGES: { city: ServiceCity; slug: string }[] = [
  { city: "Bethesda", slug: "youth-pickleball-bethesda" },
  { city: "North Bethesda", slug: "youth-pickleball-north-bethesda" },
  { city: "Rockville", slug: "youth-pickleball-rockville" },
  { city: "Potomac", slug: "youth-pickleball-potomac" },
  { city: "Gaithersburg", slug: "youth-pickleball-gaithersburg" },
  { city: "Germantown", slug: "youth-pickleball-germantown" },
  { city: "Silver Spring", slug: "youth-pickleball-silver-spring" },
  { city: "Olney", slug: "youth-pickleball-olney" },
];

/**
 * Geographic neighbors among the cities that HAVE landing pages — used for
 * the "nearby areas" cross-links so no city page is an internal-link orphan.
 */
export const CITY_NEIGHBORS: Record<string, ServiceCity[]> = {
  Bethesda: ["North Bethesda", "Potomac", "Silver Spring"],
  "North Bethesda": ["Bethesda", "Rockville", "Potomac"],
  Rockville: ["North Bethesda", "Potomac", "Gaithersburg"],
  Potomac: ["Bethesda", "North Bethesda", "Rockville"],
  Gaithersburg: ["Rockville", "Germantown", "Olney"],
  Germantown: ["Gaithersburg", "Rockville", "Potomac"],
  "Silver Spring": ["Bethesda", "Olney", "Rockville"],
  Olney: ["Rockville", "Silver Spring", "Gaithersburg"],
};

export function cityPageForCity(city: ServiceCity) {
  return CITY_LANDING_PAGES.find((p) => p.city === city);
}

/** PostalAddress used everywhere — county-level, no street (sessions rotate). */
export const NGA_POSTAL_ADDRESS = {
  "@type": "PostalAddress",
  addressLocality: "Montgomery County",
  addressRegion: "MD",
  addressCountry: "US",
} as const;

/**
 * ─── Entity graph (AEO audit, 2026-09-13) ─────────────────────────────────
 * ONE organization node, emitted in the root layout by organizationJsonLd(),
 * carrying @id #organization. Every other node (SportsEvent.organizer,
 * Course.provider, LocalBusiness.parentOrganization, BlogPosting.publisher,
 * Person.worksFor) points at it through orgRef(). Refs are typed AND named on
 * purpose: the org and Person nodes do not appear on every page, so a bare
 * { "@id" } would lose its label for any reader that doesn't stitch pages.
 *
 * This file is the only place the literal `"@type": "SportsOrganization"` may
 * appear — pinned by e2e/entity-graph.spec.ts.
 */
export const ORG_ID = `${SITE_URL}/#organization`;
export const ORG_NAME = "Next Gen Pickleball Academy";
export const ORG_ALTERNATE_NAMES = ["Next Gen PB Academy", "NGA"];

/**
 * Canonical public profiles. The Google Business Profile URL is the CID form
 * derived from the verified NGA listing's `fid` (13747039329786027007) — the
 * same derivation that produces sammorrispb.com's live GBP link. MERGE GATE:
 * Sam opens it and confirms it lands on the NGA profile; if it doesn't, delete
 * that one line.
 */
export const ORG_SAME_AS = [
  "https://www.instagram.com/nextgenpickleballacademy",
  "https://www.facebook.com/profile.php?id=61579009749341",
  "https://maps.google.com/?cid=13747039329786027007",
  "https://www.sammorrispb.com",
  "https://www.linkanddink.com",
];

export const PERSON_IDS = {
  "Sam Morris": `${SITE_URL}/#sam-morris`,
  "Amine Lahlou": `${SITE_URL}/#amine-lahlou`,
} as const;

export type CoachName = keyof typeof PERSON_IDS;

export const PERSON_SAME_AS: Record<CoachName, string[]> = {
  "Sam Morris": ["https://www.sammorrispb.com"],
  "Amine Lahlou": [],
};

/** Typed, named reference to the one organization node. */
export function orgRef() {
  return {
    "@type": "SportsOrganization",
    "@id": ORG_ID,
    name: ORG_NAME,
    url: SITE_URL,
  };
}

/** Typed, named reference to a coach's Person node (emitted on the home page). */
export function personRef(name: CoachName) {
  return { "@type": "Person", "@id": PERSON_IDS[name], name };
}

/**
 * Wraps the service area into schema.org entities, county first: Montgomery
 * County and its cities, then each out-of-county area NGA actually coaches in.
 */
export function areaServedJsonLd() {
  return [
    { "@type": "AdministrativeArea", name: "Montgomery County, MD" },
    ...SERVICE_AREAS.map((c) => ({ "@type": "City" as const, name: c })),
    ...EXTENDED_SERVICE_AREAS.flatMap((a) => [
      { "@type": "AdministrativeArea" as const, name: a.county },
      { "@type": "City" as const, name: a.city },
    ]),
  ];
}

/**
 * The one organization node — root layout only. Typed as both a
 * SportsOrganization (what NGA is) and a SportsActivityLocation (the repo
 * convention for the layout node, and what local readers look for).
 */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["SportsOrganization", "SportsActivityLocation"],
    "@id": ORG_ID,
    name: ORG_NAME,
    alternateName: ORG_ALTERNATE_NAMES,
    description:
      "Structured youth pickleball coaching for kids ages 6\u201316 in Montgomery County, MD, plus Saturday youth leagues at The Pickl Park in Frederick, MD.",
    url: SITE_URL,
    logo: `${SITE_URL}/images/og-image.png`,
    telephone: "301-325-4731",
    email: "nextgenacademypb@gmail.com",
    address: NGA_POSTAL_ADDRESS,
    sameAs: ORG_SAME_AS,
    areaServed: areaServedJsonLd(),
    founder: [personRef("Sam Morris"), personRef("Amine Lahlou")],
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/** schema.org BreadcrumbList from an ordered list of (name, url) pairs. */
export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * LocalBusiness JSON-LD for a city landing page. `city` becomes the primary
 * `areaServed`; the full service-area list is appended so cross-city search
 * still resolves to one academy.
 */
export function localBusinessJsonLd({
  city,
  url,
  description,
}: {
  city: ServiceCity;
  url: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "SportsActivityLocation"],
    name: `Next Gen Pickleball Academy — ${city}`,
    description,
    url,
    telephone: "301-325-4731",
    email: "nextgenacademypb@gmail.com",
    address: NGA_POSTAL_ADDRESS,
    areaServed: [
      { "@type": "City", name: city },
      ...SERVICE_AREAS.filter((c) => c !== city).map((c) => ({
        "@type": "City" as const,
        name: c,
      })),
      { "@type": "AdministrativeArea", name: "Montgomery County, MD" },
    ],
    parentOrganization: orgRef(),
  };
}

/**
 * LocalBusiness JSON-LD for an OUT-OF-COUNTY landing page. Address stays
 * county-level (same convention as NGA_POSTAL_ADDRESS — no street, because the
 * business isn't the venue; the Pickl Park street address lives on its
 * SportsEvent nodes). areaServed runs county → city → the named nearby towns →
 * the MoCo towns between the two venues → Montgomery County.
 */
export function extendedAreaLocalBusinessJsonLd({
  area,
  url,
  description,
}: {
  area: ExtendedServiceArea;
  url: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "SportsActivityLocation"],
    name: `${ORG_NAME} — ${area.city}`,
    description,
    url,
    telephone: "301-325-4731",
    email: "nextgenacademypb@gmail.com",
    address: {
      "@type": "PostalAddress",
      addressLocality: area.county.replace(/, MD$/, ""),
      addressRegion: "MD",
      addressCountry: "US",
    },
    areaServed: [
      { "@type": "AdministrativeArea", name: area.county },
      { "@type": "City", name: area.city },
      ...area.nearbyTowns.map((t) => ({ "@type": "City" as const, name: t })),
      { "@type": "City", name: "Clarksburg" },
      ...area.crossLinkCities.map((c) => ({ "@type": "City" as const, name: c })),
      { "@type": "AdministrativeArea", name: "Montgomery County, MD" },
    ],
    parentOrganization: orgRef(),
  };
}

/**
 * A single Course (Red/Orange/Green/Yellow tier). audienceType=Children;
 * suggestedMinAge derived from the level's age floor.
 */
export interface CourseTier {
  name: string;
  description: string;
  educationalLevel: string;
  minAge: number;
  /** Every tier runs to the academy ceiling unless a tier says otherwise. */
  maxAge?: number;
  ballColor: "Red" | "Orange" | "Green" | "Yellow";
  /** The page that describes this tier (e.g. /levels). */
  url?: string;
  /** The tier a player comes from, e.g. "Red Ball" for Orange. */
  prerequisite?: string;
}

export function courseJsonLd(tier: CourseTier) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: tier.name,
    description: tier.description,
    educationalLevel: tier.educationalLevel,
    audience: {
      "@type": "PeopleAudience",
      audienceType: "Children",
      suggestedMinAge: tier.minAge,
      suggestedMaxAge: tier.maxAge ?? 16,
    },
    provider: orgRef(),
    teaches: `Pickleball — ${tier.ballColor} Ball tier`,
    ...(tier.url ? { url: tier.url } : {}),
    ...(tier.prerequisite ? { coursePrerequisites: tier.prerequisite } : {}),
  };
}

/** BlogPosting for /blog/[slug] — author and publisher reference the graph. */
export function blogPostingJsonLd(post: BlogPost) {
  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.headline,
    description: post.description,
    datePublished: post.datePublished,
    url,
    mainEntityOfPage: url,
    author: { ...personRef("Sam Morris"), jobTitle: "Head Coach" },
    publisher: orgRef(),
  };
}
