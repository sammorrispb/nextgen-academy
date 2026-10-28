// Kill switch for adding guests, changing a round's players and re-planning
// after a round. Off from #441 until Link & Dink released the backend
// (community-os #1931, migrations 20261025184544 + 20261025215925, applied and
// verified in production 2026-10-26). Set it back to false to pull the three
// controls if the backend is rolled back.
export const LEAGUE_PLAYER_CHANGES_ENABLED = true;

export const PLAYER_CHANGES_UNAVAILABLE = {
  ok: false as const,
  message:
    "Adding players, changing rounds and re-planning are temporarily unavailable. Check-in, planning and scoring are still available.",
};
