// Community1931's commands and migrations must clear review and be released
// before these controls can be enabled. Player-ref fields alone are no proof.
export const LEAGUE_PLAYER_CHANGES_ENABLED = false;

export const PLAYER_CHANGES_UNAVAILABLE = {
  ok: false as const,
  message:
    "Adding players, changing rounds and re-planning are temporarily unavailable. Check-in, planning and scoring are still available.",
};
