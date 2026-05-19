import Link from "next/link";
import type { Metadata } from "next";
import { verifyCancelToken } from "@/lib/cancel-token";
import { findDropInPageByCheckoutId } from "@/lib/notion-dropins";
import CancelClient from "./CancelClient";

export const metadata: Metadata = {
  title: "Cancel reservation · NGA",
  description: "Cancel your NGA drop-in reservation.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

function formatLongDate(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function CancelPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  return (
    <section className="bg-ngpa-navy min-h-[80vh] py-16 sm:py-24 px-4 sm:px-6 lg:px-10">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
          NGA · Self-serve cancel
        </p>
        <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-8">
          Cancel your reservation
        </h1>

        {await renderBody(token)}
      </div>
    </section>
  );
}

async function renderBody(token: string | undefined) {
  if (!token) {
    return (
      <InvalidLink>
        This cancel link is missing its token. Use the link from your
        confirmation email, or reply to that email and we&rsquo;ll handle it.
      </InvalidLink>
    );
  }

  const cs = verifyCancelToken(token);
  if (!cs) {
    return (
      <InvalidLink>
        This link isn&rsquo;t valid. Reply to your confirmation email or text
        Sam at <a href="tel:13013254731" className="text-ngpa-teal underline">301-325-4731</a> and we&rsquo;ll help.
      </InvalidLink>
    );
  }

  const dropIn = await findDropInPageByCheckoutId(cs);
  if (!dropIn) {
    return (
      <InvalidLink>
        We couldn&rsquo;t find this reservation. It may have already been
        cancelled or refunded.
      </InvalidLink>
    );
  }

  if (dropIn.status !== "Confirmed") {
    return (
      <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-6 sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-ngpa-skill-green mb-2">
          Already cancelled
        </p>
        <p className="text-base text-ngpa-white/85 leading-relaxed mb-6">
          This reservation was already marked <strong>{dropIn.status}</strong>.
          Nothing else to do.
        </p>
        <Link
          href="/schedule"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-ngpa-lime text-ngpa-deep font-bold text-sm hover:brightness-110 transition-all min-h-[44px]"
        >
          Back to schedule
        </Link>
      </div>
    );
  }

  return (
    <CancelClient
      token={token}
      childFirstName={dropIn.childFirstName}
      sessionTitle={dropIn.sessionTitle}
      sessionDateLong={formatLongDate(dropIn.sessionDate)}
      sessionStart={dropIn.sessionStartTime}
    />
  );
}

function InvalidLink({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-6 sm:p-8">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-400 mb-2">
        Link not recognized
      </p>
      <p className="text-base text-ngpa-white/85 leading-relaxed mb-6">
        {children}
      </p>
      <Link
        href="/schedule"
        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-ngpa-slate/60 text-ngpa-white/85 hover:border-ngpa-teal hover:text-ngpa-teal font-bold text-sm min-h-[44px] transition-colors"
      >
        Back to schedule
      </Link>
    </div>
  );
}
