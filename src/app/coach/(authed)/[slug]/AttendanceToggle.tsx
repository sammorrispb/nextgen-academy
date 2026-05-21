"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAttendanceAction } from "./actions";
import type { AttendanceValue } from "@/lib/notion-dropins";

interface Props {
  checkoutSessionId: string;
  attendance: AttendanceValue | "";
}

export default function AttendanceToggle({
  checkoutSessionId,
  attendance,
}: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState<AttendanceValue | "">(attendance);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!checkoutSessionId) return null;

  function set(next: AttendanceValue) {
    // Tapping the active state again clears it (undo a mis-tap).
    const attended = current === next ? "clear" : next;
    startTransition(async () => {
      setError(null);
      const result = await markAttendanceAction({
        checkoutSessionId,
        attended,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCurrent(result.attendance ?? "");
      router.refresh();
    });
  }

  const base =
    "px-2.5 py-1 rounded-full text-xs font-bold border transition-colors disabled:opacity-50 min-h-[28px]";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => set("Present")}
        disabled={pending}
        aria-pressed={current === "Present"}
        className={
          current === "Present"
            ? `${base} bg-emerald-500/20 text-emerald-300 border-emerald-500/50`
            : `${base} bg-transparent text-ngpa-white/45 border-ngpa-slate/50 hover:text-emerald-300 hover:border-emerald-500/40`
        }
      >
        ✓ Here
      </button>
      <button
        type="button"
        onClick={() => set("No-show")}
        disabled={pending}
        aria-pressed={current === "No-show"}
        className={
          current === "No-show"
            ? `${base} bg-red-500/20 text-red-300 border-red-500/50`
            : `${base} bg-transparent text-ngpa-white/45 border-ngpa-slate/50 hover:text-red-300 hover:border-red-500/40`
        }
      >
        No-show
      </button>
      {error && <span className="text-red-400 text-[10px]">{error}</span>}
    </div>
  );
}
