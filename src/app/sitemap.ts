import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://nextgenpbacademy.com";
  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/schedule`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
  ];
}
