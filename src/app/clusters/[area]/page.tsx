import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { CLUSTER_FAQ } from "@/data/cluster-faq";
import {
  buildCrewWaitlistHref,
  getAllClusterSlugs,
  getClusterBySlug,
} from "@/lib/clusters";
import { getSchoolsForCluster } from "@/lib/schools";
import { breadcrumbJsonLd, SITE_URL } from "@/lib/seo";

interface ClusterRouteProps {
  params: Promise<{ area: string }>;
}

// Pre-rendered at build time — keeps the four pages static + fast.
export function generateStaticParams() {
  return getAllClusterSlugs().map((slug) => ({ area: slug }));
}

export async function generateMetadata({
  params,
}: ClusterRouteProps): Promise<Metadata> {
  const { area } = await params;
  const cluster = getClusterBySlug(area);
  if (!cluster) return {};

  const title = `${cluster.name} — NGA Youth Pickleball, ${cluster.neighborhoods.join(" · ")}`;
  const description = `${cluster.blurb} Join the Fall 2026 interest list.`;
  const url = `https://nextgenpbacademy.com/clusters/${cluster.slug}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/clusters/${cluster.slug}` },
    openGraph: {
      title,
      description,
      url,
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

const COLOR_CLASSES: Record<
  string,
  { chip: string; chipText: string; cta: string; ctaHover: string }
> = {
  "down-county": {
    chip: "bg-[#00B4D8]",
    chipText: "text-ngpa-navy",
    cta: "bg-[#00B4D8] text-ngpa-navy",
    ctaHover: "hover:bg-[#48CAE4]",
  },
  "up-county": {
    chip: "bg-[#AADC00]",
    chipText: "text-ngpa-navy",
    cta: "bg-[#AADC00] text-ngpa-navy",
    ctaHover: "hover:bg-[#BFE635]",
  },
  "east-county": {
    chip: "bg-[#FF6B2B]",
    chipText: "text-ngpa-navy",
    cta: "bg-[#FF6B2B] text-ngpa-navy",
    ctaHover: "hover:bg-[#FF8A52]",
  },
  "mid-county": {
    chip: "bg-[#00D4FF]",
    chipText: "text-ngpa-navy",
    cta: "bg-[#00D4FF] text-ngpa-navy",
    ctaHover: "hover:bg-[#5BE3FF]",
  },
};

export default async function ClusterPage({ params }: ClusterRouteProps) {
  const { area } = await params;
  const cluster = getClusterBySlug(area);
  if (!cluster) notFound();

  const cls = COLOR_CLASSES[cluster.slug];
  const url = `${SITE_URL}/clusters/${cluster.slug}`;
  const waitlistHref = buildCrewWaitlistHref(cluster.slug);
  const highSchools = getSchoolsForCluster(cluster.slug, "high");
  const middleSchools = getSchoolsForCluster(cluster.slug, "middle");

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Clusters", url: `${SITE_URL}/clusters` },
          { name: cluster.name, url },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: CLUSTER_FAQ.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }}
      />
      <main
        data-testid="cluster-main"
        className="min-h-screen bg-ngpa-navy text-ngpa-white"
      >
        <section className="mx-auto max-w-3xl px-5 pt-12 pb-8 sm:pt-20">
          <nav className="mb-6 text-sm text-ngpa-muted">
            <Link href="/clusters" className="hover:text-ngpa-white">
              ← All clusters
            </Link>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <span
              aria-hidden="true"
              className={`inline-block h-8 w-8 rounded-full ${cls.chip}`}
            />
            <span
              data-testid="coming-soon-pill"
              className="rounded-full border border-ngpa-lime/40 px-3 py-1 text-xs font-semibold text-ngpa-lime"
            >
              Coming Fall 2026
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
            {cluster.name}
          </h1>
          <p className="mt-4 text-lg text-ngpa-white/90">{cluster.blurb}</p>
          <p className="mt-3 text-sm text-ngpa-muted">
            Families from{" "}
            <span data-testid="neighborhoods">
              {cluster.neighborhoods.join(", ")}
            </span>
            {" "}— join the interest list to hear first when registration opens.
          </p>

          <div className="mt-8">
            <Link
              href={waitlistHref}
              data-testid="waitlist-cta"
              className={`inline-flex min-h-[48px] items-center justify-center rounded-full ${cls.cta} ${cls.ctaHover} px-6 py-3 font-semibold transition`}
            >
              Join the {cluster.name} interest list
            </Link>
          </div>
          <p
            data-testid="eval-fallback"
            className="mt-4 text-sm text-ngpa-muted"
          >
            Not sure if your kid is ready for group play?{" "}
            <Link
              href="/free-evaluation"
              className="font-semibold text-ngpa-teal-bright underline-offset-2 hover:underline"
            >
              Start with a free evaluation
            </Link>
            {" "}— we&apos;ll place them on the pathway and tell you whether a
            cluster or private lessons fit best right now.
          </p>
        </section>

        <section
          className="mx-auto max-w-3xl px-5 pb-16"
          data-testid="cluster-schools"
        >
          <h2 className="mb-3 text-2xl font-bold">
            MCPS schools in the {cluster.region} area
          </h2>
          <p className="mb-6 text-sm text-ngpa-white/85">
            Go to one of these schools? This is your cluster. Lists follow
            geography, not MCPS attendance boundaries — families near the edge
            of an area are welcome to join whichever cluster fits their drive.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div data-testid="cluster-high-schools">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-ngpa-muted">
                High schools
              </h3>
              <ul className="space-y-2 text-sm text-ngpa-white/85">
                {highSchools.map((s) => (
                  <li
                    key={s.name}
                    className="rounded-lg border border-ngpa-slate bg-ngpa-panel px-4 py-2.5"
                  >
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-ngpa-muted"> · {s.town}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div data-testid="cluster-middle-schools">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-ngpa-muted">
                Middle schools
              </h3>
              <ul className="space-y-2 text-sm text-ngpa-white/85">
                {middleSchools.map((s) => (
                  <li
                    key={s.name}
                    className="rounded-lg border border-ngpa-slate bg-ngpa-panel px-4 py-2.5"
                  >
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-ngpa-muted"> · {s.town}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-20" data-testid="cluster-faq">
          <h2 className="mb-6 text-2xl font-bold">Parent FAQ</h2>
          <div className="space-y-4">
            {CLUSTER_FAQ.map((item, i) => (
              <details
                key={i}
                className="group rounded-xl border border-ngpa-slate bg-ngpa-panel p-5"
              >
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="inline-flex w-full items-center justify-between">
                    <span>{item.question}</span>
                    <span
                      aria-hidden="true"
                      className="text-ngpa-muted transition group-open:rotate-180"
                    >
                      ▾
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm text-ngpa-white/85">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
