import type { ClusterSlug } from "./clusters";

// The pre-launch guard, made mechanical. clusters.ts says "no registration, no
// Stripe... until coach roster + venue decisions are locked" — these booleans
// ARE that lock. /api/checkout-cluster refuses to sell while a cluster's gates
// are false, so flipping a cluster live is an explicit, reviewable commit:
// confirm the head coach (vetted, NGA youth standard) + the contracted venue,
// then set both flags here. Never flip a gate speculatively.

export interface ClusterLaunchGates {
  coachConfirmed: boolean;
  venueConfirmed: boolean;
}

export const CLUSTER_LAUNCH_GATES: Readonly<
  Record<ClusterSlug, ClusterLaunchGates>
> = {
  "down-county": { coachConfirmed: false, venueConfirmed: false },
  "up-county": { coachConfirmed: false, venueConfirmed: false },
  "east-county": { coachConfirmed: false, venueConfirmed: false },
  "mid-county": { coachConfirmed: false, venueConfirmed: false },
};

export function isClusterLaunchable(slug: ClusterSlug): boolean {
  const gates = CLUSTER_LAUNCH_GATES[slug];
  return Boolean(gates?.coachConfirmed && gates?.venueConfirmed);
}

export type ClusterCheckoutGateResult =
  | { ok: true }
  | { ok: false; status: 503; message: string };

export function resolveClusterCheckoutGate(
  gates: ClusterLaunchGates | undefined,
  stripePriceId: string | undefined,
): ClusterCheckoutGateResult {
  if (!gates?.coachConfirmed || !gates?.venueConfirmed || !stripePriceId) {
    return {
      ok: false,
      status: 503,
      message:
        "Cluster registration isn't open yet — join the interest list at /crew and you'll get first access when it is.",
    };
  }
  return { ok: true };
}
