import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { getAllClusters } from "@/lib/clusters";
import { breadcrumbJsonLd, SITE_URL } from "@/lib/seo";

const PAGE_TITLE = "NGA Clusters — Fall 2026 Interest List";
const PAGE_DESCRIPTION =
  "Regional youth pickleball teams across Montgomery County — Down-County, Up-County, East-County, Mid-County. Year-round training, age-division play. Join the Fall 2026 interest list for your area.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/clusters" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "https://nextgenpbacademy.com/clusters",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

// Static Tailwind class mappings — never compute class names from data (Tailwind
// purges anything it can't statically prove). The map keeps clusters dark-surface-
// safe; Lime per the brand guide is dark-bg only and we render on bg-ngpa-navy.
const COLOR_CLASSES: Record<
  string,
  { ring: string; chip: string; chipText: string; cardBorder: string }
> = {
  "down-county": {
    ring: "ring-[#00B4D8]",
    chip: "bg-[#00B4D8]",
    chipText: "text-ngpa-navy",
    cardBorder: "border-[#00B4D8]/40",
  },
  "up-county": {
    ring: "ring-[#AADC00]",
    chip: "bg-[#AADC00]",
    chipText: "text-ngpa-navy",
    cardBorder: "border-[#AADC00]/40",
  },
  "east-county": {
    ring: "ring-[#FF6B2B]",
    chip: "bg-[#FF6B2B]",
    chipText: "text-ngpa-navy",
    cardBorder: "border-[#FF6B2B]/40",
  },
  "mid-county": {
    ring: "ring-[#00D4FF]",
    chip: "bg-[#00D4FF]",
    chipText: "text-ngpa-navy",
    cardBorder: "border-[#00D4FF]/40",
  },
};

export default function ClustersIndexPage() {
  const clusters = getAllClusters();
  const url = `${SITE_URL}/clusters`;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Clusters", url },
        ])}
      />
      <main className="min-h-screen bg-ngpa-navy text-ngpa-white">
        <section className="mx-auto max-w-5xl px-5 pt-12 pb-8 sm:pt-20">
          <div
            data-testid="coming-soon-banner"
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-ngpa-lime/40 bg-ngpa-deep px-4 py-2 text-sm font-semibold text-ngpa-lime"
          >
            <span aria-hidden="true">●</span>
            Coming Fall 2026 — interest list open now
          </div>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
            NGA Clusters
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ngpa-white/90">
            Four regional teams. One pathway. Kids train year-round with their
            NGA coach, build real reps in age-division play, and finish the
            season at the MoCo Cup.
          </p>
          <p className="mt-3 max-w-2xl text-base text-ngpa-muted">
            Down-County, Up-County, East-County, Mid-County — find your area,
            join your cluster. Better than yesterday, together.
          </p>
        </section>

        <section
          className="mx-auto max-w-5xl px-5 pb-16"
          data-testid="cluster-grid"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            {clusters.map((c) => {
              const cls = COLOR_CLASSES[c.slug];
              return (
                <Link
                  key={c.slug}
                  href={`/clusters/${c.slug}`}
                  data-testid={`cluster-card-${c.slug}`}
                  className={`block rounded-2xl border ${cls.cardBorder} bg-ngpa-panel p-6 transition hover:bg-ngpa-slate focus:outline-none focus-visible:ring-2 ${cls.ring} min-h-[180px]`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={`inline-block h-6 w-6 rounded-full ${cls.chip}`}
                    />
                    <h2 className="text-2xl font-bold">{c.name}</h2>
                  </div>
                  <p className="mt-2 text-sm text-ngpa-white/85">{c.blurb}</p>
                  <p className="mt-3 text-xs text-ngpa-muted">
                    {c.neighborhoods.join(" · ")}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-20 text-sm text-ngpa-muted">
          <h2 className="mb-3 text-base font-semibold text-ngpa-white">
            What clusters are not
          </h2>
          <p>
            NGA Clusters are not MCPS varsity. Every MCPS high school already
            runs a Fall corollary pickleball team and we cheer that on. Clusters
            are the year-round, age-division feeder layer that gets kids
            match-ready before tryouts — and keeps them sharp the rest of the
            year.
          </p>
        </section>
      </main>
    </>
  );
}
