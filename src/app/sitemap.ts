import type { MetadataRoute } from "next";
import { getAllClusterSlugs } from "@/lib/clusters";
import { CITY_LANDING_PAGES } from "@/lib/seo";
import { CAMPS } from "@/data/camps";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://nextgenpbacademy.com";
  const lastModified = new Date();
  const clusterEntries: MetadataRoute.Sitemap = [
    { url: `${base}/clusters`, lastModified, changeFrequency: "weekly", priority: 0.75 },
    ...getAllClusterSlugs().map((slug) => ({
      url: `${base}/clusters/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })),
  ];
  return [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/free-evaluation`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/schools`, lastModified, changeFrequency: "monthly", priority: 0.85 },
    { url: `${base}/montgomery-county-youth-pickleball`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/montgomery-village-youth-pickleball`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/schedule`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/camp`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    ...CAMPS.map((camp) => ({
      url: `${base}/camp/${camp.slug}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    { url: `${base}/newsletter`, lastModified, changeFrequency: "weekly", priority: 0.75 },
    { url: `${base}/crew`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/league`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    ...clusterEntries,
    // City landing pages — local SEO.
    ...CITY_LANDING_PAGES.map(({ slug }) => ({
      url: `${base}/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
