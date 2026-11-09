import { NextResponse } from "next/server";

// Retired with Sam's explicit approval on 2026-11-09. Keep this endpoint for
// stale forms, but never parse their parent/child data or create a new checkout.
// No flag or price setting can reopen this completed season. Existing payments,
// webhook fulfillment, registrations and signed family links remain untouched.
export async function POST() {
  return NextResponse.json(
    {
      code: "registration_closed",
      error: "The Fall 2026 season has ended. Registration is closed.",
    },
    { status: 410 },
  );
}
