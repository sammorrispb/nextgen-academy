import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // The sessions feed is the one deliberately-public /api surface —
        // aggregate session data, no PII (see sessions-feed.ts) — advertised
        // in llms.txt for AI agents. Everything else under /api stays closed.
        allow: ["/", "/api/sessions/feed"],
        disallow: ["/api/", "/admin/", "/coach/"],
      },
    ],
    sitemap: "https://nextgenpbacademy.com/sitemap.xml",
  };
}
