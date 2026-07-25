import Link from "next/link";
import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import { blogPosts } from "@/data/blog";
import { breadcrumbJsonLd, SITE_URL } from "@/lib/seo";

const TITLE = "Youth Pickleball Blog — Coach's Notes from MoCo";
const DESCRIPTION =
  "Coach-written guides for MoCo parents: youth pickleball safety, the Red-to-Yellow progression, where kids play, and what to expect at a first session.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/blog`,
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function BlogIndexPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Blog", url: `${SITE_URL}/blog` },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Next Gen Pickleball Academy Blog",
          description: DESCRIPTION,
          url: `${SITE_URL}/blog`,
          publisher: {
            "@type": "SportsOrganization",
            name: "Next Gen Pickleball Academy",
            url: SITE_URL,
          },
          blogPost: blogPosts.map((post) => ({
            "@type": "BlogPosting",
            headline: post.headline,
            url: `${SITE_URL}/blog/${post.slug}`,
            datePublished: post.datePublished,
          })),
        }}
      />

      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        <div className="absolute inset-x-0 top-0 h-96 bg-teal-glow pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-16 sm:pb-20">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-4">
            Coach&rsquo;s Notes
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl font-black text-ngpa-white leading-[1.05] tracking-tight">
            The youth pickleball blog for{" "}
            <span className="text-ngpa-teal">MoCo parents</span>.
          </h1>
          <p className="mt-6 text-lg text-ngpa-white/80 leading-relaxed max-w-2xl">
            Straight answers from the coaches on court — how kids learn this
            game, where to play in Montgomery County, and how to get started.
          </p>
        </div>
      </section>

      <section className="bg-ngpa-navy py-14 sm:py-16 px-4 sm:px-6 lg:px-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6">
          {blogPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-7 hover:border-ngpa-teal/60 transition-colors"
            >
              <time
                dateTime={post.datePublished}
                className="font-mono text-xs text-ngpa-white/55"
              >
                {post.datePublished}
              </time>
              <h2 className="font-heading text-xl font-black text-ngpa-white mt-2 mb-3 tracking-tight group-hover:text-ngpa-teal transition-colors">
                {post.headline}
              </h2>
              <p className="text-base text-ngpa-white/70 leading-relaxed">
                {post.description}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-ngpa-teal font-bold text-sm">
                Read the post
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
