import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { manualLineupEditingAvailable, LINEUP_EDIT_HOLD_MESSAGE } from '../src/lib/season-league/lineup-release';

// Same real-wrapper harness approach as invariant-rotation-league-release-gate.
// Substitute request-scoped auth and persistence only; execute the actual action
// module and actual release gate. No network or real coach session is involved.
function harness(authorized: boolean, mutateGate = false) {
  const delegated: string[] = [];
  const revalidated: string[] = [];
  let authCalls = 0;
  const view = new Proxy({}, { get: (_, name: string) => {
    if (name === 'parseGroup') return () => 'Yellow';
    if (name === 'parseWeek') return () => 6;
    return async () => { delegated.push(name); return { ok: true }; };
  } });
  const module = { exports: {} as Record<string, (input: unknown) => Promise<unknown>> };
  const source = readFileSync('src/app/coach/(authed)/fall-season/actions.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  runInNewContext(code, { module, exports: module.exports, require: (id: string) => {
    if (id === '@/lib/coach-auth-server') return { requireCoach: async () => { authCalls++; return authorized ? 'coach@example.com' : null; } };
    if (id === '@/lib/season-league/lineup-release') return { manualLineupEditingAvailable: mutateGate ? () => true : manualLineupEditingAvailable, LINEUP_EDIT_HOLD_MESSAGE };
    if (id === '@/lib/season-league-view') return view;
    if (id === 'next/cache') return { revalidatePath: (path: string) => revalidated.push(path) };
    if (id === '@/data/season-league-2026') return { seasonLeagueGroupSlug: () => 'yellow' };
    throw new Error(`Unexpected action dependency: ${id}`);
  } });
  return { actions: module.exports, delegated, revalidated, authCalls: () => authCalls };
}

const staleClientInput = { group: 'Yellow', week: 6, round: 1, expected: [], games: [] };

test('authorized stale client cannot delegate lineup mutation or revalidate', async () => {
  const h = harness(true);
  expect(await h.actions.editRoundLineupAction(staleClientInput)).toEqual({ ok: false, message: LINEUP_EDIT_HOLD_MESSAGE });
  expect(h.authCalls()).toBe(1);
  expect(h.delegated).toEqual([]);
  expect(h.revalidated).toEqual([]);
});

test('unauthorized edit still stops at shared coach authentication', async () => {
  const h = harness(false);
  expect(await h.actions.editRoundLineupAction(staleClientInput)).toEqual({ ok: false, message: 'Unauthorized' });
  expect(h.authCalls()).toBe(1);
  expect(h.delegated).toEqual([]);
});

test('existing score action still delegates when coach is authorized', async () => {
  const h = harness(true);
  expect(await h.actions.recordScoreAction({ group: 'Yellow', week: 6, key: 'game', expectedSideA: ['a'], expectedSideB: ['b'], scoreA: 11, scoreB: 4, timed: false })).toEqual({ ok: true });
  expect(h.delegated).toEqual(['recordGameScore']);
});

test('mutation control: an opened gate reaches persistence and would violate zero-call pin', async () => {
  const h = harness(true, true);
  expect(await h.actions.editRoundLineupAction(staleClientInput)).toEqual({ ok: true });
  expect(h.delegated).toEqual(['editRoundLineup']);
});
