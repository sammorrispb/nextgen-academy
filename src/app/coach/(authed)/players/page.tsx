import Link from "next/link";
import { fetchAllDropInsInRange } from "@/lib/notion-dropins";
import { buildFamilyDirectory } from "@/lib/player-profiles";

export const dynamic = "force-dynamic";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDate(date: string): string {
  if (!date) return "—";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function PlayersIndexPage() {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 365);
  const to = new Date(now);
  to.setDate(to.getDate() + 60);

  const rows = await fetchAllDropInsInRange(isoDate(from), isoDate(to));
  const families = buildFamilyDirectory(rows);

  return (
    <>
      <Link
        href="/coach"
        className="inline-flex items-center gap-1 text-sm text-ngpa-white/70 hover:text-ngpa-teal mb-6 transition-colors"
      >
        ← All sessions
      </Link>

      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        Families
      </h1>
      <p className="text-base text-ngpa-white/70 mb-8">
        Every family who has registered, with their attendance and payment history.
      </p>

      {families.length === 0 ? (
        <div className="px-5 py-6 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60 text-ngpa-white/70">
          No registrations yet.
        </div>
      ) : (
        <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-ngpa-white/55 bg-ngpa-deep/40">
              <tr>
                <th className="text-left font-bold px-4 sm:px-5 py-3">Family</th>
                <th className="text-left font-bold px-4 sm:px-5 py-3">Players</th>
                <th className="text-right font-bold px-4 sm:px-5 py-3 hidden sm:table-cell">Last session</th>
                <th className="text-right font-bold px-4 sm:px-5 py-3">Regs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ngpa-slate/40">
              {families.map((f) => (
                <tr key={f.key} className="hover:bg-ngpa-deep/30">
                  <td className="px-4 sm:px-5 py-3 align-top">
                    <Link
                      href={`/coach/players/${f.key}`}
                      className="text-ngpa-teal font-bold hover:underline"
                    >
                      {f.parentName}
                    </Link>
                  </td>
                  <td className="px-4 sm:px-5 py-3 align-top text-ngpa-white/80">
                    {f.childNames.join(", ") || "—"}
                  </td>
                  <td className="px-4 sm:px-5 py-3 align-top text-right text-ngpa-white/70 hidden sm:table-cell">
                    {formatDate(f.lastSessionDate)}
                  </td>
                  <td className="px-4 sm:px-5 py-3 align-top text-right font-mono text-ngpa-white/85">
                    {f.registrations}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
