import { rollupFailure, type CronFailure } from "@/lib/cron-alert";
import type { CurriculumOverridesResult } from "@/lib/notion-curriculum";

/**
 * Turn a curriculum-override read into cron alert signatures.
 *
 * Pure, so the decision of what is and is not worth waking Sam for is testable
 * without any alert plumbing. Two rules carry the whole design:
 *
 *   config_missing is NOT a failure. NOTION_CURRICULUM_DB_ID unset is the
 *   deliberate ships-dark state — alerting on it would page every deploy that
 *   hasn't turned the feature on yet. (This is the one place the posture
 *   differs from the newsletter-drafts cron, where an unset DB id genuinely is
 *   a misconfiguration because the lead block is meant to ship.)
 *
 *   An unresolvable Field ID IS a failure. A typo'd `rule.red.serv` changes
 *   nothing, looks exactly like a working row in Notion, and would otherwise
 *   sit there for a whole season while Sam believed the copy had changed —
 *   the fetchApprovedNewsletterDrafts lesson, applied one surface over.
 *
 * Bodies carry field ids and page ids only, never the override prose.
 */
export function curriculumHealthFailures(
  result: Pick<CurriculumOverridesResult, "overrides" | "status">,
  unknownFieldIds: readonly string[],
): CronFailure[] {
  const failures: CronFailure[] = [];

  if (result.status === "query_failed") {
    failures.push({
      signature: "curriculum_overrides_query_failed",
      detail:
        "the curriculum-overrides query failed, so /coach/fall-playbook is serving the code defaults; every edit made in Notion is currently NOT showing",
    });
  }

  const unknown = rollupFailure(
    "curriculum_override_unknown_field",
    [...unknownFieldIds],
    "override rows name a Field ID that resolves to nothing, so those edits are NOT showing on the playbook — fix the id or untick Active. Field ids",
  );
  if (unknown) failures.push(unknown);

  return failures;
}
