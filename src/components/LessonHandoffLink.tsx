import Link from "next/link";
import type { ReactNode } from "react";
import { LESSON_HANDOFF_LINE } from "@/data/scheduling";

// A lesson link and the line saying where it goes, as one unit. Lesson requests
// are taken on linkanddink.com, so an in-body lesson link renders through this
// component and the line cannot be dropped or reworded on one surface alone.
// The navbar, the sticky mobile button, the paid-invoice link on
// /lessons/success and emails are exempt and link plainly.
//
// The line is a block <span>, not a <p>: two of the three callers sit inside a
// paragraph, where a nested <p> or <div> is invalid HTML.
export default function LessonHandoffLink({
  href,
  className,
  noteClassName = "mt-2 text-sm text-ngpa-white/65 leading-relaxed",
  children,
}: {
  href: string;
  className?: string;
  noteClassName?: string;
  children: ReactNode;
}) {
  const link = href.startsWith("/") ? (
    // No prefetch: /lessons/book probes the coach host and redirects on every
    // request, so it should only run when a parent actually taps.
    <Link href={href} prefetch={false} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
  return (
    <>
      {link}
      <span className={`block ${noteClassName}`}>{LESSON_HANDOFF_LINE}</span>
    </>
  );
}
