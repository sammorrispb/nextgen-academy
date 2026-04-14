import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://nextgenpbacademy.com";
  const lastModified = new Date();
  return [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/free-evaluation`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/montgomery-county-youth-pickleball`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/schedule`, lastModified, changeFrequency: "weekly", priority: 0.8 },
  ];
}
