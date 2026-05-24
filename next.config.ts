import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
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
