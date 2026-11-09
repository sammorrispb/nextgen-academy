/** Hard release gate: Notion does not provide atomic edit/score updates.
 * No environment toggle: reopen only after the persistence protocol is reviewed.
 */
export function manualLineupEditingAvailable(): boolean {
  return false;
}

export const LINEUP_EDIT_HOLD_MESSAGE = 'Player editing is temporarily unavailable while score-safety protections are completed. Existing games and score entry are unchanged.';
