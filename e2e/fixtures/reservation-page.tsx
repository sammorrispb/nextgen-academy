"use client";

import { useSyncExternalStore } from "react";
import SessionCard from "@/components/SessionCard";
import type { NgaSession } from "@/lib/notion-sessions";

// Copied to a route ONLY inside the browser runner's private workspace. The
// test freezes its browser clock to October 2 before mounting the real card.
const sample: NgaSession = {
  id: "browser-fixture-session", title: "Sample youth session", date: "2026-10-03",
  startTime: "6:00 PM", endTime: "7:00 PM", level: "Green",
  location: "Sample test court", publicArea: "", courtCount: 1, maxCourts: 1,
  capacity: 4, registeredCount: 0, spotsLeft: 4, status: "Open", roster: [],
  ageStats: null, coachReminderSent: false,
};

const subscribe = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;

export default function ReservationFixture() {
  // Mount after hydration so the fixed browser clock determines availability,
  // independently of the server's real clock and build date.
  const mounted = useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
  const state = mounted ? new URLSearchParams(window.location.search).get("state") : null;
  const session: NgaSession = {
    ...sample,
    ...(state === "full" ? { spotsLeft: 0, status: "Full" } : {}),
    ...(state === "cancelled" ? { status: "Cancelled" } : {}),
    ...(state === "outside-window" ? { date: "2026-11-03" } : {}),
  };

  return (
    <section className="max-w-lg mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Reservation browser fixture</h1>
      {mounted && <SessionCard session={session} siteOrigin="http://127.0.0.1:3191" />}
    </section>
  );
}
