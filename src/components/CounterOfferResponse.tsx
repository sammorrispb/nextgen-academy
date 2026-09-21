"use client";

import { useState } from "react";

export default function CounterOfferResponse({
  token,
  suggested,
}: {
  token: string;
  suggested: "accept" | "decline";
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<"accept" | "decline" | null>(null);

  async function respond(decision: "accept" | "decline") {
    if (working) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/lesson-booking-respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setResult(decision);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setWorking(false);
    }
  }

  if (result === "accept") {
    return (
      <div className="rounded-2xl bg-ngpa-teal/10 ring-1 ring-ngpa-teal/30 p-8">
        <h2 className="font-heading text-2xl font-black text-ngpa-white">You&apos;re on the calendar.</h2>
        <p className="mt-3 text-ngpa-white/75">
          Confirmation and a calendar invite are on their way to your email.
        </p>
      </div>
    );
  }

  if (result === "decline") {
    return (
      <div className="rounded-2xl bg-ngpa-white/5 ring-1 ring-ngpa-white/15 p-8">
        <h2 className="font-heading text-2xl font-black text-ngpa-white">No problem.</h2>
        <p className="mt-3 text-ngpa-white/75">
          Your coach will reach out directly to find a time that works.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          onClick={() => respond("accept")}
          disabled={working}
          className={`rounded-full px-8 py-4 font-bold text-lg disabled:opacity-40 ${
            suggested === "accept"
              ? "bg-ngpa-teal text-ngpa-deep hover:bg-ngpa-teal/90"
              : "bg-ngpa-white/10 text-ngpa-white ring-1 ring-ngpa-white/20 hover:bg-ngpa-white/15"
          }`}
        >
          {working ? "…" : "Yes, book it"}
        </button>
        <button
          type="button"
          onClick={() => respond("decline")}
          disabled={working}
          className={`rounded-full px-8 py-4 font-bold text-lg disabled:opacity-40 ${
            suggested === "decline"
              ? "bg-ngpa-teal text-ngpa-deep hover:bg-ngpa-teal/90"
              : "bg-ngpa-white/10 text-ngpa-white ring-1 ring-ngpa-white/20 hover:bg-ngpa-white/15"
          }`}
        >
          {working ? "…" : "Doesn't work for me"}
        </button>
      </div>
      {error && (
        <p className="mt-4 text-sm font-semibold text-red-300" role="alert">{error}</p>
      )}
    </div>
  );
}
