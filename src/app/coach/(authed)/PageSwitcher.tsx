"use client";

import { useRouter, usePathname } from "next/navigation";

// Every page-view route in the site. Dynamic routes carry a `pattern` (the
// Next.js segment shape) so the switcher can reuse the slug you're already on
// instead of sending you to the placeholder href.
type Route = {
  label: string;
  href: string;
  pattern?: string;
};

const ROUTES: Route[] = [
  { label: "Home", href: "/" },
  { label: "Free Evaluation", href: "/free-evaluation" },
  {
    label: "Montgomery County (SEO)",
    href: "/montgomery-county-youth-pickleball",
  },
  { label: "Newsletter", href: "/newsletter" },
  { label: "Schools", href: "/schools" },
  { label: "Yellow Ball Inquiry", href: "/yellowball/inquiry" },
  { label: "Schedule", href: "/schedule" },
  {
    label: "Session detail",
    href: "/schedule/sample-session",
    pattern: "/schedule/[slug]",
  },
  { label: "Schedule — success", href: "/schedule/success" },
  { label: "Schedule — cancel", href: "/schedule/cancel" },
  { label: "Coach — home", href: "/coach" },
  {
    label: "Coach — session",
    href: "/coach/sample-session",
    pattern: "/coach/[slug]",
  },
  { label: "Coach — players", href: "/coach/players" },
  {
    label: "Coach — player profile",
    href: "/coach/players/sample-key",
    pattern: "/coach/players/[key]",
  },
  { label: "Coach — login", href: "/coach/login" },
  {
    label: "Coach — cancel session",
    href: "/coach/cancel-session/sample-token",
    pattern: "/coach/cancel-session/[token]",
  },
];

function matchesPattern(pathname: string, pattern: string): boolean {
  const p = pattern.split("/").filter(Boolean);
  const a = pathname.split("/").filter(Boolean);
  if (p.length !== a.length) return false;
  return p.every((seg, i) => seg.startsWith("[") || seg === a[i]);
}

function currentIndex(pathname: string): number {
  const exact = ROUTES.findIndex((r) => r.href === pathname);
  if (exact !== -1) return exact;
  return ROUTES.findIndex((r) => r.pattern && matchesPattern(pathname, r.pattern));
}

export default function PageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const index = currentIndex(pathname);

  // On a dynamic route, keep the real slug you're viewing for that entry.
  const hrefFor = (r: Route, i: number) =>
    r.pattern && i === index ? pathname : r.href;

  const go = (i: number) => {
    const next = ((i % ROUTES.length) + ROUTES.length) % ROUTES.length;
    router.push(hrefFor(ROUTES[next], next));
  };

  const btn =
    "flex items-center justify-center min-h-[32px] min-w-[32px] px-2 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal transition-colors font-bold text-xs disabled:opacity-40 disabled:hover:border-ngpa-slate/60 disabled:hover:text-ngpa-white";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(index === -1 ? 0 : index - 1)}
        className={btn}
        aria-label="Previous page"
      >
        &larr;
      </button>
      <select
        value={index === -1 ? "" : String(index)}
        onChange={(e) => {
          const i = Number(e.target.value);
          router.push(hrefFor(ROUTES[i], i));
        }}
        aria-label="Jump to page"
        className="min-h-[32px] rounded-full border border-ngpa-slate/60 bg-ngpa-panel px-3 py-1 text-xs font-bold text-ngpa-white hover:border-ngpa-teal focus:border-ngpa-teal focus:outline-none transition-colors max-w-[12rem]"
      >
        {index === -1 && (
          <option value="" disabled>
            Jump to page&hellip;
          </option>
        )}
        {ROUTES.map((r, i) => (
          <option key={r.href} value={String(i)}>
            {r.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => go(index === -1 ? 0 : index + 1)}
        className={btn}
        aria-label="Next page"
      >
        &rarr;
      </button>
    </div>
  );
}
