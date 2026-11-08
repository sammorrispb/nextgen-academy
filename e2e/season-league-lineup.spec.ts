import { manualLineupEditingAvailable } from '../src/lib/season-league/lineup-release';
import { test, expect } from '@playwright/test';
import { replaceLineupPlayer, validLineup, type LineupGame } from '../src/lib/season-league/lineup';
const games: LineupGame[] = [
  { key: 'd', round: 1, court: 1, format: 'doubles', sideA: ['a','b'], sideB: ['c','d'] },
  { key: 's', round: 1, court: 2, format: 'singles', sideA: ['e'], sideB: ['f'] },
];
test('selecting an on-court player swaps across courts without duplicates', () => {
  const result = replaceLineupPlayer(games, 'd', 'sideA', 0, 'e');
  expect(result[0].sideA).toEqual(['e','b']); expect(result[1].sideA).toEqual(['a']);
  expect(validLineup(result, ['a','b','c','d','e','f'])).toBe(true);
  expect(games[0].sideA).toEqual(['a','b']);
});
test('can swap opponents, teammates, or replace with a sitting player', () => {
  for (const player of ['b','c','g']) {
    expect(validLineup(replaceLineupPlayer(games, 'd', 'sideA', 0, player), ['a','b','c','d','e','f','g'])).toBe(true);
  }
});
test('rejects duplicates, absent players and malformed side sizes', () => {
  expect(validLineup([...games, games[0]], ['a','b','c','d','e','f'])).toBe(false);
  expect(validLineup(games, ['a'])).toBe(false);
  expect(validLineup([{...games[0], sideA: ['a']}], ['a','b','c','d','e','f'])).toBe(false);
});


test('editor retains its opening baseline and score forms reset on participant changes', async () => {
  const { readFileSync } = await import('node:fs');
  const editor = readFileSync('src/app/coach/(authed)/fall-season/RoundLineupEditor.tsx', 'utf8');
  expect(editor).toContain('setBaseline(games)');
  expect(editor).toContain('expected: baseline');
  expect(editor).not.toContain('expected: games');
  const page = readFileSync('src/app/coach/(authed)/fall-season/[group]/[week]/page.tsx', 'utf8');
  expect(page).toContain('key={JSON.stringify([g.key, g.sideA, g.sideB])}');
});


test('release gate is closed in UI and server action, including stale clients', async () => {
  expect(manualLineupEditingAvailable()).toBe(false);
  const { readFileSync } = await import('node:fs');
  const actions = readFileSync('src/app/coach/(authed)/fall-season/actions.ts', 'utf8');
  const action = actions.slice(actions.indexOf('export async function editRoundLineupAction'));
  expect(action).toContain('if (!manualLineupEditingAvailable()) return { ok: false, message: LINEUP_EDIT_HOLD_MESSAGE }');
  expect(action.indexOf('if (!manualLineupEditingAvailable())')).toBeLessThan(action.indexOf('await editRoundLineup(input)'));
  const page = readFileSync('src/app/coach/(authed)/fall-season/[group]/[week]/page.tsx', 'utf8');
  expect(page).toContain('manualLineupEditingAvailable() ? <RoundLineupEditor');
});
