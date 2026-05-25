import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://nextgenpbacademy.com";
  const lastModified = new Date();
  return [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/free-evaluation`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/schools`, lastModified, changeFrequency: "monthly", priority: 0.85 },
    { url: `${base}/montgomery-county-youth-pickleball`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/schedule`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/newsletter`, lastModified, changeFrequency: "weekly", priority: 0.75 },
    // City landing pages — local SEO.
    { url: `${base}/youth-pickleball-bethesda`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/youth-pickleball-north-bethesda`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/youth-pickleball-rockville`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/youth-pickleball-potomac`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/youth-pickleball-gaithersburg`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/youth-pickleball-germantown`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/youth-pickleball-silver-spring`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/youth-pickleball-olney`, lastModified, changeFrequency: "monthly", priority: 0.7 },
  ];
}
