import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://nextgenpbacademy.com";
  const launch = new Date("2026-03-11");
  return [
    { url: base, lastModified: launch, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/programs`, lastModified: launch, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/schedule`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/about`, lastModified: launch, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/contact`, lastModified: launch, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/faq`, lastModified: launch, changeFrequency: "monthly", priority: 0.8 },
  ];
}
