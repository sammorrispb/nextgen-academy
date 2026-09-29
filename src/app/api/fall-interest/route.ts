import { NextResponse } from "next/server";
import { site } from "@/data/site";

/**
 * Retired. The /fall season survey (FallInterestForm) was replaced by season
 * registration and is rendered nowhere, but this route stayed live and
 * upserted by email — so anyone who knew a family's address could overwrite
 * that family's child fields, and have NGA email the address and forward the
 * answers to Open Brain (security review 2026-09-28 follow-up). With no form
 * left to call it, it writes nothing and sends nothing. The survey's answers
 * stay in the Fall Interest DB, read by the coach calendar
 * (fetchFallInterestDemand). Pinned by
 * e2e/invariant-fall-interest-pii-egress.spec.ts.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: `The fall survey has closed. Questions? Email ${site.email}.`,
    },
    { status: 410 },
  );
}
