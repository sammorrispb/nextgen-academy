import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { blogPosts, findBlogPost } from "@/data/blog";
import { breadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { familySiteUrl } from "@/lib/urls";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = findBlogPost(slug);
  if (!post) return {};
  return {
    title: { absolute: post.title },
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = findBlogPost(slug);
  if (!post) notFound();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Blog", url: `${SITE_URL}/blog` },
          { name: post.headline, url: `${SITE_URL}/blog/${post.slug}` },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.headline,
          description: post.description,
          datePublished: post.datePublished,
          url: `${SITE_URL}/blog/${post.slug}`,
          mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
          author: {
            "@type": "Person",
            name: "Sam Morris",
            jobTitle: "Head Coach",
          },
          publisher: {
            "@type": "SportsOrganization",
            name: "Next Gen Pickleball Academy",
            url: SITE_URL,
          },
        }}
      />

      <article className="bg-ngpa-deep">
        <header className="relative isolate overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-96 bg-teal-glow pointer-events-none" />
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-10">
            <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-4">
              Coach&rsquo;s Notes &middot;{" "}
              <time dateTime={post.datePublished} className="font-mono normal-case tracking-normal">
                {post.datePublished}
              </time>
            </p>
            <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-black text-ngpa-white leading-[1.1] tracking-tight">
              {post.headline}
            </h1>
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 pb-16 sm:pb-20">
          {post.sections.map((section, i) => (
            <section key={i} className="mt-8 first:mt-0">
              {section.heading && (
                <h2 className="font-heading text-2xl font-black text-ngpa-white tracking-tight mb-4">
                  {section.heading}
                </h2>
              )}
              {section.paragraphs.map((paragraph, j) => (
                <p
                  key={j}
                  className="text-lg text-ngpa-white/80 leading-relaxed mb-5"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}

          {post.links && post.links.length > 0 && (
            <aside className="mt-10 pt-6 border-t border-ngpa-slate/50">
              <h2 className="font-heading text-xs font-bold text-ngpa-white uppercase tracking-[0.2em] mb-3">
                Related
              </h2>
              <ul className="space-y-2 text-base">
                {post.links.map((link) => (
                  <li key={link.href}>
                    {link.family ? (
                      <a
                        href={familySiteUrl(link.family, link.href, `blog_${post.slug}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ngpa-teal font-bold hover:text-ngpa-teal-bright underline-offset-4 hover:underline transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-ngpa-teal font-bold hover:text-ngpa-teal-bright underline-offset-4 hover:underline transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </aside>
          )}

          <div className="mt-12 rounded-3xl border-2 border-ngpa-teal/30 bg-ngpa-panel/60 backdrop-blur p-8 text-center">
            <h2 className="font-heading text-2xl font-black text-ngpa-white tracking-tight mb-3">
              Ready to see it in person?
            </h2>
            <p className="text-base text-ngpa-white/75 mb-6 max-w-md mx-auto">
              Every Next Gen player starts with a free 30-minute evaluation —
              no cost, no commitment, ages 6&ndash;16.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href="/free-evaluation"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
              >
                Book a Free Evaluation
              </Link>
              <Link
                href="/schedule"
                className="inline-flex items-center justify-center px-7 py-3.5 bg-white/10 ring-1 ring-white/30 text-ngpa-white font-bold rounded-full hover:bg-white/15 transition-all min-h-[48px]"
              >
                See the Schedule
              </Link>
            </div>
          </div>

          <p className="mt-10 text-sm text-ngpa-white/55">
            <Link
              href="/blog"
              className="text-ngpa-teal hover:text-ngpa-teal-bright font-bold underline-offset-4 hover:underline transition-colors"
            >
              &larr; All posts
            </Link>
          </p>
        </div>
      </article>
    </>
  );
}
