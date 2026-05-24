// Shared SEO helpers used across pages so JSON-LD stays consistent.
// Keeps the address + areaServed list in ONE place — change here, every page
// (homepage, location landers, etc.) picks it up.

export const SITE_URL = "https://nextgenpbacademy.com" as const;

/**
 * MoCo cities the academy actively serves. Order matters — used as
 * `areaServed` in LocalBusiness / SportsActivityLocation schema.
 */
export const SERVICE_AREAS = [
  "Bethesda",
  "Rockville",
  "Potomac",
  "Gaithersburg",
  "Chevy Chase",
  "Olney",
  "Silver Spring",
] as const;

export type ServiceCity = (typeof SERVICE_AREAS)[number];

/** PostalAddress used everywhere — county-level, no street (sessions rotate). */
export const NGA_POSTAL_ADDRESS = {
  "@type": "PostalAddress",
  addressLocality: "Montgomery County",
  addressRegion: "MD",
  addressCountry: "US",
} as const;

/** Wraps SERVICE_AREAS into schema.org City entities, county first. */
export function areaServedJsonLd() {
  return [
    { "@type": "AdministrativeArea", name: "Montgomery County, MD" },
    ...SERVICE_AREAS.map((c) => ({ "@type": "City" as const, name: c })),
  ];
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
    parentOrganization: {
      "@type": "SportsOrganization",
      name: "Next Gen Pickleball Academy",
      url: SITE_URL,
    },
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
  ballColor: "Red" | "Orange" | "Green" | "Yellow";
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
      suggestedMaxAge: 16,
    },
    provider: {
      "@type": "SportsOrganization",
      name: "Next Gen Pickleball Academy",
      url: SITE_URL,
    },
    teaches: `Pickleball — ${tier.ballColor} Ball tier`,
  };
}
