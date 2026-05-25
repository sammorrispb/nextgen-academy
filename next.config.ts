import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      // ── www → apex (canonical-host 301) ──────────────────────────
      // Production verification 2026-05-25 showed both
      // https://www.nextgenpbacademy.com/ and https://nextgenpbacademy.com/
      // returning 200 with identical content (same etag) — duplicate-content
      // SEO problem. Apex has 2× the historical click volume (65 vs 31)
      // and the brand uses no-www everywhere, so consolidate to apex.
      // Requires Vercel to have www.nextgenpbacademy.com attached to the
      // project; the rule no-ops at the edge if the host never reaches us.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.nextgenpbacademy.com" }],
        destination: "https://nextgenpbacademy.com/:path*",
        permanent: true,
      },
      { source: "/programs", destination: "/#levels", permanent: true },
      { source: "/about", destination: "/#about", permanent: true },
      { source: "/contact", destination: "/#contact", permanent: true },
      { source: "/faq", destination: "/#faq", permanent: true },
      { source: "/free-trial", destination: "/free-evaluation", permanent: true },
      // ── Legacy Squarespace URLs still in Google's index ───────────
      // Squarespace appended numeric `-N` suffixes to disambiguate
      // titles ("/about-us-1", "/contact-us-1"). The old "/about-us-1"
      // page was actually the #1 organic result on 2026-05-24.
      { source: "/about-us-1", destination: "/#about", permanent: true },
      { source: "/about-us", destination: "/#about", permanent: true },
      { source: "/about-us-2", destination: "/#about", permanent: true },
      { source: "/contact-us", destination: "/#contact", permanent: true },
      { source: "/contact-us-1", destination: "/#contact", permanent: true },
      { source: "/our-programs", destination: "/#levels", permanent: true },
      { source: "/our-programs-1", destination: "/#levels", permanent: true },
      { source: "/our-coaches", destination: "/#about", permanent: true },
      { source: "/our-coaches-1", destination: "/#about", permanent: true },
      { source: "/home", destination: "/", permanent: true },
      { source: "/home-1", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
