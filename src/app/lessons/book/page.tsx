import type { Metadata } from "next";
import Link from "next/link";
import { getStripe } from "@/lib/stripe";
import { formatLongDate } from "@/lib/format-date";
import LessonBookingForm from "@/components/LessonBookingForm";

export const metadata: Metadata = {
  title: "Pick Your Lesson Time",
  description:
    "Propose up to three times for your Next Gen lesson — a coach confirms or suggests another time.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ inv?: string }>;
}

export default async function LessonBookPage({ searchParams }: PageProps) {
  const { inv } = await searchParams;

  if (!inv || !process.env.STRIPE_SECRET_KEY) {
    return <BookShell title="Find your invoice">Use the booking link from your payment confirmation email to pick a lesson time.</BookShell>;
  }

  let invoice;
  try {
    invoice = await getStripe().invoices.retrieve(inv);
  } catch {
    return <BookShell title="Invoice not found">We couldn&apos;t find that invoice — use the booking link from your payment confirmation email.</BookShell>;
  }

  const m = invoice.metadata ?? {};
  if (m.kind !== "lesson") {
    return <BookShell title="Lessons only">This booking page is for private and group lessons.</BookShell>;
  }

  const childName = String(m.child_first_name ?? "");
  const lessonTitle = String(m.lesson_title ?? "Lesson");

  if (invoice.status !== "paid") {
    const payUrl = invoice.hosted_invoice_url ?? null;
    return (
      <BookShell title="One step first">
        <p className="text-ngpa-white/75">
          {childName ? `${childName}'s` : "Your"} {lessonTitle.toLowerCase()} invoice
          isn&apos;t paid yet — once it&apos;s paid you can pick your lesson time here.
        </p>
        {payUrl && (
          <a
            href={payUrl}
            className="inline-block mt-6 rounded-full bg-ngpa-teal px-8 py-3 font-bold text-ngpa-deep hover:bg-ngpa-teal/90"
          >
            Pay the invoice
          </a>
        )}
      </BookShell>
    );
  }

  if (m.booking_status === "confirmed" && m.booking_date && m.booking_time) {
    return (
      <BookShell title="You're on the calendar">
        <p className="text-lg text-ngpa-white/85">
          {childName ? `${childName}'s` : "Your"} {lessonTitle.toLowerCase()} is confirmed
          for <strong className="text-ngpa-white">{formatLongDate(m.booking_date)} at {m.booking_time}</strong>.
        </p>
        <p className="mt-3 text-ngpa-white/60">
          Your coach will confirm the court location before the lesson. Need to move it? Just reply to your confirmation email.
        </p>
      </BookShell>
    );
  }

  return (
    <section className="bg-ngpa-deep min-h-[70vh] px-4 sm:px-6 lg:px-10 py-12">
      <div className="max-w-2xl mx-auto">
        <p className="text-ngpa-teal font-semibold tracking-wide text-sm uppercase">
          {lessonTitle} — paid ✓
        </p>
        <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mt-2">
          Pick {childName ? `${childName}'s` : "your"} lesson time.
        </h1>
        <p className="mt-3 text-ngpa-white/70 leading-relaxed">
          Choose up to three dates and times that work. A coach will confirm one
          of them — or propose a different time — usually within a day.
        </p>
        <div className="mt-8">
          <LessonBookingForm invoiceId={invoice.id} />
        </div>
      </div>
    </section>
  );
}

function BookShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-ngpa-deep min-h-[60vh] flex items-center px-4 sm:px-6 lg:px-10 py-20">
      <div className="max-w-xl mx-auto text-center">
        <h1 className="font-heading text-3xl font-black text-ngpa-white tracking-tight">
          {title}
        </h1>
        <div className="mt-4 text-ngpa-white/75 leading-relaxed">{children}</div>
        <Link
          href="/lessons"
          className="inline-block mt-8 text-ngpa-teal font-semibold hover:underline"
        >
          ← Back to lessons
        </Link>
      </div>
    </section>
  );
}
