"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/funnelClient";
import { disclosureIdForHash } from "@/lib/home-structure";

const SELECTOR = "details[data-home-disclosure]";

/**
 * Opens the folded home section a link points at.
 *
 * `/about` and `/faq` redirect to `/#about` and `/#faq`, and the menu, the
 * footer and other pages link to the same anchors. Those arrive three ways:
 * a cold load, the browser's own hash navigation, and the App Router, which
 * moves with history.pushState and so fires no hashchange. One click listener
 * covers the router; load, hashchange and popstate cover the rest.
 */
export default function HomeDisclosureOpener({ folded }: { folded: readonly string[] }) {
  // The list arrives as a fresh array with every server render. Keying the
  // effect on its contents keeps a refresh from re-running it, which would
  // re-open a fold the parent had closed and scroll them back to it.
  const key = folded.join("|");

  useEffect(() => {
    const ids = key.split("|");
    // Folds this component opened itself. Only a parent's own tap on a fold
    // is counted as interest in it.
    const openedHere = new Set<string>();

    function open(hash: string, scroll: boolean) {
      const id = disclosureIdForHash(hash, ids);
      if (!id) return;
      const fold = document.getElementById(id);
      if (!(fold instanceof HTMLDetailsElement)) return;
      if (!fold.open) {
        openedHere.add(id);
        fold.open = true;
      }
      if (scroll) fold.scrollIntoView({ block: "start" });
    }

    const fromLocation = () => open(window.location.hash, true);

    function onClick(event: MouseEvent) {
      // A modified click opens the link somewhere else; leave this page alone.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || !link.hash) return;
      if (link.origin !== window.location.origin || link.pathname !== window.location.pathname) return;
      // Open before the navigation runs so whatever scrolls next finds the
      // section already laid out.
      open(link.hash, false);
    }

    function onToggle(event: Event) {
      const fold = event.target;
      if (!(fold instanceof HTMLDetailsElement) || !fold.matches(SELECTOR) || !fold.open) return;
      if (openedHere.delete(fold.id)) return;
      trackEvent("cta_click", { label: `home_disclosure_open_${fold.id}`, section: "home_more" });
    }

    fromLocation();
    // A client-side arrival can mount this before the router has written the
    // new hash to the address bar.
    const frame = window.requestAnimationFrame(fromLocation);
    document.addEventListener("click", onClick, true);
    document.addEventListener("toggle", onToggle, true);
    window.addEventListener("hashchange", fromLocation);
    window.addEventListener("popstate", fromLocation);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("toggle", onToggle, true);
      window.removeEventListener("hashchange", fromLocation);
      window.removeEventListener("popstate", fromLocation);
    };
  }, [key]);

  return null;
}
