import type { MetadataRoute } from "next";
import { getAllClusterSlugs } from "@/lib/clusters";
import { CITY_LANDING_PAGES, EXTENDED_AREA_LANDING_PAGES } from "@/lib/seo";
import { CAMPS } from "@/data/camps";
import { blogPosts } from "@/data/blog";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://nextgenpbacademy.com";
  // No shared `new Date()`: stamping every URL with the build time told search
  // engines every page changed on every deploy, so they learn to ignore the
  // field. Only entries with a real content date carry one — blog posts use
  // datePublished — and everything else omits it (e2e/sitemap.spec.ts).
  const clusterEntries: MetadataRoute.Sitemap = [
    { url: `${base}/clusters`, changeFrequency: "weekly", priority: 0.75 },
    ...getAllClusterSlugs().map((slug) => ({
      url: `${base}/clusters/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })),
  ];
  return [
    { url: base, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/free-evaluation`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/schools`, changeFrequency: "monthly", priority: 0.85 },
    { url: `${base}/montgomery-county-youth-pickleball`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/montgomery-village-youth-pickleball`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/schedule`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/levels`, changeFrequency: "monthly", priority: 0.75 },
    { url: `${base}/fall`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/picklpark`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/camp`, changeFrequency: "weekly", priority: 0.8 },
    ...CAMPS.map((camp) => ({
      url: `${base}/camp/${camp.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    { url: `${base}/newsletter`, changeFrequency: "weekly", priority: 0.75 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.7 },
    ...blogPosts.map((post) => ({
      url: `${base}/blog/${post.slug}`,
      lastModified: post.datePublished,
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })),
    { url: `${base}/crew`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/league`, changeFrequency: "monthly", priority: 0.7 },
    ...clusterEntries,
    // City landing pages — local SEO.
    ...[...CITY_LANDING_PAGES, ...EXTENDED_AREA_LANDING_PAGES].map(({ slug }) => ({
      url: `${base}/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
