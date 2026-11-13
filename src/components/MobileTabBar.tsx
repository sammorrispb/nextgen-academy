"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/data/site";
import { trackEvent } from "@/lib/funnelClient";
import { MORE_LINKS, TABS, activeMoreHref, activeTab, tabBarHidden, type TabKey } from "@/lib/mobile-tabs";
import { stickyCtaFor } from "@/lib/sticky-cta";

const ICONS: Record<TabKey | "more", string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z",
  levels: "M4 20V10m5.33 10V4m5.34 16v-8M20 20V7",
  schedule: "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  more: "M4 7h16M4 12h16M4 17h16",
};

function Icon({ name }: { name: TabKey | "more" }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[name]} />
    </svg>
  );
}

const TAB =
  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 font-heading text-xs font-bold leading-tight transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ngpa-teal-bright";
const SHEET_LINK =
  "flex min-h-12 items-center rounded-lg px-3 text-base font-semibold hover:bg-ngpa-slate/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ngpa-teal-bright";

/**
 * The phone bar: three tabs, a More tab, and the page's own action. It took
 * over from the hamburger menu and the sticky button (Sam, 2026-11-13).
 *
 * The action is still stickyCtaFor(pathname): on a page where no evaluation
 * is offered (Frederick) the bar must not offer one, and on the lessons page
 * it requests a lesson. The More sheet keeps every menu door the tabs lack,
 * plus the call link the sticky button carried.
 *
 * `pathname` is for tests; the page passes nothing.
 */
export default function MobileTabBar({ pathname: forced }: { pathname?: string } = {}) {
  const current = usePathname();
  const pathname = forced ?? current;
  // The sheet is open only for the page it was opened on. This component
  // lives in the root layout and never remounts, so remembering the page is
  // what closes the sheet on any navigation, back button included.
  const [openOn, setOpenOn] = useState<string | null | undefined>(undefined);
  const open = openOn !== undefined && openOn === pathname;
  const bar = useRef<HTMLElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const close = () => setOpenOn(undefined);

  useEffect(() => {
    if (!open) return;
    // Keyboard and screen-reader users land in the sheet, not on the action
    // that follows the More tab in the page order.
    sheet.current?.querySelector("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenOn(undefined);
      moreButton.current?.focus();
    };
    // A tap anywhere outside the bar puts the sheet away.
    const onPointer = (event: PointerEvent) => {
      if (!bar.current?.contains(event.target as Node)) setOpenOn(undefined);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  if (tabBarHidden(pathname)) return null;

  const cta = stickyCtaFor(pathname);
  const active = activeTab(pathname);
  const activeMore = activeMoreHref(pathname);
  const track = (label: string, destination: string, section = "mobile_tabs") =>
    trackEvent("cta_click", { label, destination, section });

  return (
    <>
      {/* Keeps the end of the page clear of the fixed bar. */}
      <div
        data-tab-bar-spacer=""
        aria-hidden="true"
        className="h-[calc(3.5rem+env(safe-area-inset-bottom))] lg:hidden print:hidden"
      />
      <nav
        ref={bar}
        aria-label="Main"
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden print:hidden border-t border-ngpa-slate/60 bg-ngpa-deep/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid max-w-lg grid-cols-[1fr_1fr_1fr_1fr_1.7fr] items-stretch">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active === tab.key ? "page" : undefined}
              onClick={() => {
                track(`tab_${tab.key}`, tab.href);
                close();
              }}
              className={`${TAB} ${active === tab.key ? "text-ngpa-teal-bright" : "text-ngpa-white/75 hover:text-ngpa-white"}`}
            >
              <Icon name={tab.key} />
              {tab.label}
            </Link>
          ))}
          <button
            ref={moreButton}
            type="button"
            aria-controls="mobile-more"
            aria-expanded={open}
            onClick={() => {
              if (open) return close();
              track("tab_more", "#mobile-more");
              setOpenOn(pathname);
            }}
            className={`${TAB} ${open || activeMore ? "text-ngpa-teal-bright" : "text-ngpa-white/75 hover:text-ngpa-white"}`}
          >
            <Icon name="more" />
            More
          </button>
          <a
            href={cta.href}
            onClick={() => {
              track(cta.trackLabel, cta.href, "sticky_mobile");
              close();
            }}
            className="m-1 flex min-h-12 items-center justify-center rounded-2xl bg-ngpa-teal px-2 text-center font-heading text-xs font-bold leading-tight text-ngpa-deep transition-colors hover:bg-ngpa-teal-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ngpa-teal-bright"
          >
            {cta.label}
          </a>
        </div>

        <div
          ref={sheet}
          id="mobile-more"
          hidden={!open}
          className="absolute bottom-full left-0 right-0 max-h-[calc(100dvh-9rem)] overflow-y-auto border-t border-ngpa-slate/60 bg-ngpa-deep px-4 py-3 shadow-[0_-12px_32px_rgba(0,0,0,0.45)]"
        >
          <ul className="mx-auto max-w-lg">
            {MORE_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={activeMore === link.href ? "page" : undefined}
                  onClick={() => {
                    track(`more_${link.label.toLowerCase().replace(/\s+/g, "_")}`, link.href);
                    close();
                  }}
                  className={`${SHEET_LINK} ${activeMore === link.href ? "text-ngpa-teal-bright" : "text-ngpa-white"}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-ngpa-slate/40 pt-1">
              <a
                href={`tel:${site.phone.replace(/\D/g, "")}`}
                onClick={() => {
                  track("sticky_mobile_call", `tel:${site.phone}`, "sticky_mobile");
                  close();
                }}
                className={`${SHEET_LINK} text-ngpa-teal-bright`}
              >
                Call {site.phone}
              </a>
            </li>
          </ul>
        </div>
      </nav>
    </>
  );
}
