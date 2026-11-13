import type { ReactNode } from "react";

/**
 * One folded home-page section. The anchor id sits on the details element, not
 * on anything inside it, so a link or an old URL that targets the section
 * always lands on a visible, labelled row, open or closed, with or without
 * JavaScript. HomeDisclosureOpener opens it when a link points here.
 */
export default function HomeDisclosure({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  /** The short name of the section ("FAQ", "The Team"): what a parent who
   * followed /faq or /about is looking for. */
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      data-home-disclosure=""
      className="group scroll-mt-20 border-t border-ngpa-slate/40"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ngpa-teal">
        <span className="min-w-0">
          <span className="block text-xs font-bold uppercase tracking-[0.2em] text-ngpa-teal mb-1.5">
            {eyebrow}
          </span>
          <h2 className="font-heading text-xl sm:text-2xl font-black text-ngpa-white tracking-tight">
            {title}
          </h2>
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 font-heading text-2xl font-bold text-ngpa-teal transition-transform motion-reduce:transition-none group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="pb-10 pt-2">{children}</div>
    </details>
  );
}
