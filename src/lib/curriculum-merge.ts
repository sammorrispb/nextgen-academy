import {
  BALL_RULES,
  CAPTAIN_KIT,
  CAPTAIN_NEVER,
  CAPTAIN_RUN_OF_SHOW,
  CAPTAIN_SCRIPT,
  SKILL_STACK,
  type BallRules,
  type CaptainDuty,
  type SkillBlock,
} from "@/data/session-curriculum";
import { FALL_SEASON_PLAN, type SeasonWeek } from "@/data/fall-season-plan-2026";

/**
 * Curriculum override layer — the PURE half (no I/O, no env, no fetch).
 *
 * Code is the floor, Notion is an override. `src/data/session-curriculum.ts`
 * and `src/data/fall-season-plan-2026.ts` stay the tested source of truth for
 * DEFAULTS — that is what keeps e2e/session-curriculum.spec.ts meaningful, and
 * it is why PR #297 (Sam rewrote the Red serve rule, the spec went red, the
 * change became deliberate) still works after this shipped.
 *
 * Two properties this file owes the rest of the system:
 *
 *  - It NEVER mutates the arrays it is handed. Next.js module singletons live
 *    across requests in one server process, so writing into BALL_RULES in place
 *    would make an override permanent, un-revertable and visible to every other
 *    request until redeploy. Everything here is clone-on-write.
 *  - An override it cannot resolve changes nothing AND is reported. Silently
 *    dropping a typo'd Field ID is how a dud edit sits in Notion for a season
 *    while the copy never changes; `unknownFieldIds` is what the health cron
 *    turns into an alert.
 */

export interface CurriculumOverride {
  /** e.g. "rule.red.serve", "block.1.cue.0", "captain.never.4". */
  fieldId: string;
  value: string;
  /** Notion page id, carried for health alerts. The merge never reads it. */
  pageId?: string;
}

export interface CurriculumDefaults {
  ballRules: readonly BallRules[];
  skillStack: readonly SkillBlock[];
  captainRunOfShow: readonly CaptainDuty[];
  captainNever: readonly string[];
  captainScript: readonly string[];
  captainKit: readonly string[];
  seasonPlan: readonly SeasonWeek[];
}

export interface MergedCurriculum extends CurriculumDefaults {
  /** Field ids that actually replaced a string — drives the "edited" marker. */
  editedFieldIds: ReadonlySet<string>;
  /** Field ids that resolved to nothing. A typo, a deleted block, a bad index. */
  unknownFieldIds: readonly string[];
}

export const CURRICULUM_DEFAULTS: CurriculumDefaults = {
  ballRules: BALL_RULES,
  skillStack: SKILL_STACK,
  captainRunOfShow: CAPTAIN_RUN_OF_SHOW,
  captainNever: CAPTAIN_NEVER,
  captainScript: CAPTAIN_SCRIPT,
  captainKit: CAPTAIN_KIT,
  seasonPlan: FALL_SEASON_PLAN,
};

/**
 * The overridable surface, as data. Structural keys are deliberately absent:
 * `order`, `color`, `week`, `date`, `focusBlock`, the games/ritual slugs and
 * `vocabulary` are resolution keys, and rulesForColor / focusBlockFor /
 * gamesFor / ritualFor all THROW on a miss. Keeping them out of the override
 * space is how "a run sheet never renders blank" is guaranteed by construction
 * rather than by care. `SkillBlock.name` is out too — it is documented in the
 * data file as "do not rename".
 */
const RULE_PROPS: ReadonlySet<string> = new Set([
  "label",
  "ball",
  "typicalAges",
  "serve",
  "serveMiss",
  "kitchen",
  "twoBounce",
  "court",
  "scoring",
  "captainWatch",
]);

const BLOCK_PROPS: ReadonlySet<string> = new Set([
  "teaches",
  "setup",
  "formation",
  "rotation",
  "scaling",
  "captainCue",
]);

const WEEK_PROPS: ReadonlySet<string> = new Set([
  "title",
  "wordFraming",
  "coachLooksFor",
  "parentLine",
  "homeRep",
]);

const CAPTAIN_LISTS: ReadonlySet<string> = new Set(["duty", "never", "script", "kit"]);

/** 0-based array position. Rejects "-1", "two", "1.5", "" and " 1". */
function parseIndex(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

function setProp(target: object, prop: string, value: string): void {
  (target as Record<string, string>)[prop] = value;
}

interface Working {
  ballRules: BallRules[];
  skillStack: Array<SkillBlock & { cues: string[] }>;
  captainRunOfShow: CaptainDuty[];
  captainNever: string[];
  captainScript: string[];
  captainKit: string[];
  seasonPlan: SeasonWeek[];
}

function clone(defaults: CurriculumDefaults): Working {
  return {
    ballRules: defaults.ballRules.map((r) => ({ ...r })),
    skillStack: defaults.skillStack.map((b) => ({ ...b, cues: [...b.cues] })),
    captainRunOfShow: defaults.captainRunOfShow.map((d) => ({ ...d })),
    captainNever: [...defaults.captainNever],
    captainScript: [...defaults.captainScript],
    captainKit: [...defaults.captainKit],
    seasonPlan: defaults.seasonPlan.map((w) => ({ ...w })),
  };
}

/**
 * Apply one override to the working copy. Returns false when the id does not
 * resolve — the caller reports that, it is never silently swallowed.
 */
function applyOne(work: Working, fieldId: string, value: string): boolean {
  const parts = fieldId.split(".");
  const [namespace] = parts;

  if (namespace === "rule" && parts.length === 3) {
    const [, color, prop] = parts;
    if (!RULE_PROPS.has(prop)) return false;
    const rule = work.ballRules.find((r) => r.color === color);
    if (!rule) return false;
    setProp(rule, prop, value);
    return true;
  }

  if (namespace === "block") {
    const order = parseIndex(parts[1] ?? "");
    if (order === null) return false;
    const blockRow = work.skillStack.find((b) => b.order === order);
    if (!blockRow) return false;

    // block.<order>.cue.<i>
    if (parts.length === 4 && parts[2] === "cue") {
      const i = parseIndex(parts[3]);
      if (i === null || i >= blockRow.cues.length) return false;
      blockRow.cues[i] = value;
      return true;
    }

    if (parts.length === 3 && BLOCK_PROPS.has(parts[2])) {
      setProp(blockRow, parts[2], value);
      return true;
    }
    return false;
  }

  if (namespace === "captain" && parts.length === 3) {
    const [, list, rawIndex] = parts;
    if (!CAPTAIN_LISTS.has(list)) return false;
    const i = parseIndex(rawIndex);
    if (i === null) return false;

    if (list === "duty") {
      const duty = work.captainRunOfShow[i];
      // `phase` is the label the run sheet is keyed on, not copy — not overridable.
      if (!duty) return false;
      duty.duty = value;
      return true;
    }

    const target =
      list === "never"
        ? work.captainNever
        : list === "script"
          ? work.captainScript
          : work.captainKit;
    if (i >= target.length) return false;
    target[i] = value;
    return true;
  }

  if (namespace === "week" && parts.length === 3) {
    const n = parseIndex(parts[1]);
    if (n === null || !WEEK_PROPS.has(parts[2])) return false;
    // `week` is 1-indexed in the data and resolved by value, not position.
    const weekRow = work.seasonPlan.find((w) => w.week === n);
    if (!weekRow) return false;
    setProp(weekRow, parts[2], value);
    return true;
  }

  return false;
}

/**
 * Merge Notion overrides over the code defaults.
 *
 * An empty (or whitespace-only) value is a REVERT, not a blanking — Stage 1
 * has no editor, so clearing Value in Notion is one of the two ways Sam undoes
 * an edit (unticking Active is the other, and drops the row upstream). It is
 * therefore not reported as unknown: the id was fine, the intent was to revert.
 */
export function mergeCurriculum(
  defaults: CurriculumDefaults,
  overrides: readonly CurriculumOverride[],
): MergedCurriculum {
  const work = clone(defaults);
  const editedFieldIds = new Set<string>();
  const unknownFieldIds: string[] = [];

  for (const override of overrides) {
    const value = (override.value ?? "").trim();
    if (!value) continue;

    if (applyOne(work, override.fieldId, value)) {
      editedFieldIds.add(override.fieldId);
    } else if (!unknownFieldIds.includes(override.fieldId)) {
      unknownFieldIds.push(override.fieldId);
    }
  }

  return { ...work, editedFieldIds, unknownFieldIds };
}
