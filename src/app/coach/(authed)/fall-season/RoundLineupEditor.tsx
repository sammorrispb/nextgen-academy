"use client";
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { replaceLineupPlayer, type LineupGame } from '@/lib/season-league/lineup';
import { editRoundLineupAction } from './actions';

export default function RoundLineupEditor({ group, week, games, players, locked }: {
  group: string; week: number; games: LineupGame[];
  players: { id: string; name: string }[]; locked: boolean;
}) {
  const [draft, setDraft] = useState(games);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (locked) return <p className="px-4 py-2 text-xs text-ngpa-white/60">Lineup locked: round scored or final teams locked.</p>;
  return <div className="px-4 py-3 border-t border-ngpa-slate/40">
    {!editing ? <button type="button" className="min-h-11 text-sm font-bold text-ngpa-teal" onClick={() => { setDraft(games); setEditing(true); setMessage(''); }}>Edit players</button> : <>
      <p className="text-xs text-ngpa-white/70 mb-3">Choose a player to replace a position. Selecting someone already in this round swaps their positions.</p>
      {draft.map(game => <div key={game.key} className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ngpa-white/70">Court {game.court}</span>
        {(['sideA', 'sideB'] as const).map(side => <div key={side} className="flex flex-wrap items-center gap-2">
          {side === 'sideB' && <span className="text-ngpa-white/60">vs</span>}
          {game[side].map((id, index) => <select key={`${side}-${index}`} aria-label={`Round ${game.round}, court ${game.court}, team ${side === 'sideA' ? 'A' : 'B'}, player ${index + 1}`} value={id} disabled={pending}
            className="min-h-11 rounded border border-ngpa-slate bg-ngpa-deep px-2 text-sm text-ngpa-white"
            onChange={event => setDraft(current => replaceLineupPlayer(current, game.key, side, index, event.target.value))}>
            {!players.some(p => p.id === id) && <option value={id}>Unavailable player</option>}
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>)}
        </div>)}
      </div>)}
      <button type="button" disabled={pending} className="min-h-11 rounded bg-ngpa-teal px-4 font-bold text-ngpa-deep mr-3" onClick={() => startTransition(async () => {
        try {
          const result = await editRoundLineupAction({ group, week, round: games[0].round, expected: games, games: draft });
          setMessage(result.message);
          setEditing(false);
          router.refresh();
        } catch { setMessage('Could not verify save. Reload and check the lineup before scoring.'); setEditing(false); router.refresh(); }
      })}>{pending ? 'Saving…' : 'Save lineup'}</button>
      <button type="button" disabled={pending} className="min-h-11 text-sm text-ngpa-white/70" onClick={() => setEditing(false)}>Cancel</button>
    </>}
    {message && <p role="status" className="mt-2 text-sm text-ngpa-white/80">{message}</p>}
  </div>;
}
