import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "You're locked in — Next Gen Pickleball Academy",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ cs?: string }>;
}

/**
 * Post-Stripe-Checkout landing page for the 4-week commit. Calls
 * /api/commit/confirm server-side to bind the saved card to a Notion Crew
 * Commit row. Renders a success or recoverable-error state. The confirm
 * endpoint is idempotent so a double-load of this page is safe.
 */
export default async function CommitSuccessPage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const { cs } = await searchParams;

  let ok = false;
  let errorMessage = "";

  if (!cs) {
    errorMessage = "Missing checkout session id. Try the link again.";
  } else {
    try {
      const origin =
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";
      const res = await fetch(`${origin}/api/commit/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, checkoutSessionId: cs }),
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        ok = true;
      } else {
        errorMessage = data.error ?? "Couldn't finalize the commit.";
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Network error";
    }
  }

  return (
    <div className="min-h-screen bg-ngpa-navy text-ngpa-white">
      <section className="bg-ngpa-deep py-16 sm:py-24 px-4 sm:px-6 lg:px-10">
        <div className="max-w-2xl mx-auto">
          {ok ? (
            <div className="bg-ngpa-panel/80 backdrop-blur rounded-2xl p-8 sm:p-10 border border-ngpa-slate/60 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ngpa-green/15 mb-6">
                <svg
                  className="w-8 h-8 text-ngpa-green"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-3 tracking-tight">
                You&rsquo;re locked in.
              </h1>
              <p className="text-ngpa-white/75 text-base sm:text-lg max-w-md mx-auto mb-6">
                We&rsquo;ll auto-reserve your spot each week and charge $40 the
                morning each session opens. A receipt and skip-this-week link
                land in your inbox.
              </p>
              <Link
                href="/schedule"
                className="inline-flex items-center justify-center px-6 py-3 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
              >
                See the schedule
              </Link>
            </div>
          ) : (
            <div className="bg-ngpa-panel/80 backdrop-blur rounded-2xl p-8 sm:p-10 border border-ngpa-red/30 text-center">
              <h1 className="font-heading text-2xl sm:text-3xl font-black text-ngpa-white mb-3 tracking-tight">
                Something went sideways.
              </h1>
              <p className="text-ngpa-white/75 text-base mb-2">{errorMessage}</p>
              <p className="text-ngpa-white/55 text-sm mb-6">
                Your card was saved but the commit row didn&rsquo;t finalize.
                Email us and we&rsquo;ll fix it manually &mdash; no charge until
                we do.
              </p>
              <a
                href="mailto:nextgenacademypb@gmail.com"
                className="inline-flex items-center justify-center px-6 py-3 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
              >
                Email Coach Sam
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
