"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface FamilyHit {
  key: string;
  parentName: string;
  childNames: string[];
}

// Top-nav family search: lazy-loads a lightweight coach-scoped index on first
// focus, then filters client-side as the coach types. Matches on parent OR any
// player name; picking a result jumps straight to that family's profile.
export default function CoachFamilySearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [families, setFamilies] = useState<FamilyHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  async function ensureLoaded() {
    if (families !== null || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/coach/family-search", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { families?: FamilyHit[] };
        setFamilies(data.families ?? []);
      } else {
        setFamilies([]);
      }
    } catch {
      setFamilies([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const q = query.trim().toLowerCase();
  const results =
    q && families
      ? families
          .filter((f) =>
            [f.parentName, ...f.childNames].join(" ").toLowerCase().includes(q),
          )
          .slice(0, 8)
      : [];

  function go(hit: FamilyHit) {
    setOpen(false);
    setQuery("");
    router.push(`/coach/players/${hit.key}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) go(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative w-40 sm:w-64">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          void ensureLoaded();
        }}
        onKeyDown={onKeyDown}
        placeholder="Search families…"
        aria-label="Search families by parent or player name"
        className="w-full rounded-full border border-ngpa-slate/60 bg-ngpa-panel/80 text-ngpa-white text-sm px-4 py-2 min-h-[40px] placeholder:text-ngpa-white/40 focus:outline-none focus:border-ngpa-teal"
      />
      {open && q && (
        <div className="absolute right-0 mt-2 w-72 max-w-[80vw] max-h-80 overflow-y-auto rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel shadow-xl z-50">
          {loading && families === null ? (
            <p className="px-4 py-3 text-sm text-ngpa-white/60">Loading…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ngpa-white/60">No matches.</p>
          ) : (
            <ul className="py-1">
              {results.map((f, i) => (
                <li key={f.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(f)}
                    className={`w-full text-left px-4 py-2.5 transition-colors ${
                      i === active ? "bg-ngpa-deep/50" : "hover:bg-ngpa-deep/30"
                    }`}
                  >
                    <span className="block text-sm font-bold text-ngpa-white">
                      {f.parentName}
                    </span>
                    {f.childNames.length > 0 && (
                      <span className="block text-xs text-ngpa-white/55 truncate">
                        {f.childNames.join(", ")}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
