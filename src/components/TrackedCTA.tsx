"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { trackEvent } from "@/lib/funnelClient";

type CommonProps = {
  label: string;
  section?: string;
  children: ReactNode;
  className?: string;
};

type AnchorOnly = Omit<
  ComponentPropsWithoutRef<"a">,
  keyof CommonProps | "href" | "onClick"
>;

type TrackedCTAProps = CommonProps &
  AnchorOnly & {
    href: string;
    /** Render with next/link instead of a plain <a>. Defaults to <a>. */
    asNextLink?: boolean;
  };

/**
 * Anchor / Link wrapper that fires a `cta_click` analytics event before
 * the navigation begins. Drop-in replacement for `<a href>` and
 * `<Link href>` on primary CTAs. Tracking is fire-and-forget — clicks
 * never block, even if analytics is misconfigured.
 *
 * Example:
 *   <TrackedCTA href="#contact-form" label="hero_book_eval" section="hero">
 *     Book Free Evaluation
 *   </TrackedCTA>
 */
export default function TrackedCTA({
  href,
  label,
  section,
  children,
  asNextLink = false,
  className,
  ...rest
}: TrackedCTAProps) {
  function fire() {
    try {
      trackEvent("cta_click", {
        label,
        destination: href,
        ...(section ? { section } : {}),
      });
    } catch {
      /* analytics must never block navigation */
    }
  }

  if (asNextLink) {
    return (
      <Link href={href} className={className} onClick={fire} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className} onClick={fire} {...rest}>
      {children}
    </a>
  );
}
