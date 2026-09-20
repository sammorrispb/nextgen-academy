import {
  getFallRegistrationPage,
  updateFallRegStatus,
  type FallRegistrationPage,
  type FallRegistrationPageResult,
} from "@/lib/notion-fall-registrations";
import {
  fetchSeasonLeagueRows,
  patchSeasonLeagueRelations,
} from "@/lib/notion-season-league";
import {
  playerAppearsIn,
  rewritePlayerInRows,
  type MergeableRow,
} from "@/lib/season-league/merge";
import {
  SEASON_LEAGUE_GROUPS,
  type SeasonLeagueGroup,
} from "@/data/season-league-2026";

/**
 * The write behind /admin/fall: link a trial profile to the paid registration
 * that followed it.
 *
 * WHY IT EXISTS: `PlayerId` IS a Fall Registrations page id, so a kid who plays
 * a Sunday before their family pays earns results against the row that existed
 * that day. Registering through `/api/checkout-fall` then mints a SECOND row —
 * with the waiver, emergency contact and birth year we actually want, but none
 * of the games. The duplicate guard cannot catch it: it matches an exact child
 * first name, and a kid who shares a first name with a teammate carries a last
 * initial. So the join is deliberate, here, rather than automatic in the
 * webhook — a payments Slop-Free Zone file where a wrong guess would be far
 * more expensive than an admin clicking the pair.
 *
 * It lives outside `season-league-view.ts` on purpose. That module's invariant
 * is that it writes ids and scores and never a name; this one reads names to
 * compare them, so it keeps its own file and its own spec.
 *
 * ONE GUARD DOES MOST OF THE WORK: the target must hold zero games. That makes
 * self-play, a doubled id on one side, and merging two kids who BOTH really
 * played impossible by construction rather than by branch.
 *
 * The trial row is CANCELLED, never deleted. A deleted page would strand every
 * relation pointing at it and `buildNameMap` would render "Player" on games
 * already played.
 */

export type LinkFailureReason =
  | "same_page"
  | "config_missing"
  | "not_found"
  | "wrong_database"
  | "query_failed"
  | "unknown_group"
  | "group_mismatch"
  | "target_not_confirmed"
  | "target_has_games"
  | "write_failed";

export type LinkFallProfileResult =
  | {
      ok: true;
      rowsRewritten: number;
      group: SeasonLeagueGroup;
      trialChildName: string;
      targetChildName: string;
      /** The names differ, so the results moved under a different label. */
      renameHint: boolean;
      trialCancelled: boolean;
    }
  | { ok: false; reason: LinkFailureReason; message: string };

function lookupFailure(result: Exclude<FallRegistrationPageResult, { status: "ok" }>, which: string): LinkFallProfileResult {
  const message =
    result.status === "config_missing"
      ? "NOTION_FALL_REGS_DB_ID is not set."
      : result.status === "not_found"
        ? `The ${which} row no longer exists.`
        : result.status === "wrong_database"
          ? `That ${which} page isn't in the Fall Registrations database.`
          : `Couldn't read the ${which} row: ${result.message}`;
  return { ok: false, reason: result.status as LinkFailureReason, message };
}

function asGroup(raw: string): SeasonLeagueGroup | null {
  return SEASON_LEAGUE_GROUPS.find((g) => g.group === raw)?.group ?? null;
}

export async function linkFallProfile(input: {
  fromPageId: string;
  toPageId: string;
}): Promise<LinkFallProfileResult> {
  const from = input.fromPageId.trim();
  const to = input.toPageId.trim();

  if (!from || !to || from === to) {
    return { ok: false, reason: "same_page", message: "Pick two different rows to link." };
  }

  // Both pages proven to live in the Fall Regs DB before anything is read of them.
  const [trialRead, targetRead] = await Promise.all([
    getFallRegistrationPage(from),
    getFallRegistrationPage(to),
  ]);
  if (trialRead.status !== "ok") return lookupFailure(trialRead, "trial");
  if (targetRead.status !== "ok") return lookupFailure(targetRead, "paid");

  const trial: FallRegistrationPage = trialRead.page;
  const target: FallRegistrationPage = targetRead.page;

  if (trial.group !== target.group) {
    return {
      ok: false,
      reason: "group_mismatch",
      message: `Those rows are in different groups (${trial.group || "blank"} and ${target.group || "blank"}). A kid's results can't cross groups.`,
    };
  }
  const group = asGroup(target.group);
  if (!group) {
    return {
      ok: false,
      reason: "unknown_group",
      message: `"${target.group || "blank"}" isn't a season-play group.`,
    };
  }
  if (target.status !== "Confirmed") {
    return {
      ok: false,
      reason: "target_not_confirmed",
      message: `The paid row reads "${target.status || "blank"}" — link into a Confirmed registration.`,
    };
  }

  const { rows, status } = await fetchSeasonLeagueRows(group);
  if (status !== "ok") {
    return status === "config_missing"
      ? {
          ok: false,
          reason: "config_missing",
          message: "NOTION_SEASON_LEAGUE_DB_ID is not set — nothing can be linked.",
        }
      : {
          ok: false,
          reason: "query_failed",
          message: "Couldn't read the games database — try again.",
        };
  }

  const mergeable: MergeableRow[] = rows.map((r) => ({
    pageId: r.pageId,
    key: r.key,
    status: r.status,
    sideA: r.sideA,
    sideB: r.sideB,
    present: r.present,
  }));

  if (playerAppearsIn(mergeable, to)) {
    return {
      ok: false,
      reason: "target_has_games",
      message:
        "That paid row already has games of its own. Linking would merge two kids who both played — sort it out by hand.",
    };
  }

  const patches = rewritePlayerInRows(mergeable, from, to);
  const { failed } = await patchSeasonLeagueRelations(patches);
  if (failed > 0) {
    return {
      ok: false,
      reason: "write_failed",
      message: `${failed} of ${patches.length} rows didn't save. Nothing was cancelled — run it again.`,
    };
  }

  // Only once every game has moved: retiring the trial row first would strand
  // its results behind a row the roster reader still returns but nobody can pick.
  const trialCancelled = await updateFallRegStatus(from, "Cancelled");

  const trialChildName = trial.childFirstName.trim();
  const targetChildName = target.childFirstName.trim();
  return {
    ok: true,
    rowsRewritten: patches.length,
    group,
    trialChildName,
    targetChildName,
    renameHint: trialChildName !== "" && trialChildName !== targetChildName,
    trialCancelled,
  };
}
