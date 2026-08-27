import { withCronAlert } from "@/lib/cron-alert";
import { fetchCurriculumOverrides } from "@/lib/notion-curriculum";
import { curriculumHealthFailures } from "@/lib/curriculum-health";
import { CURRICULUM_DEFAULTS, mergeCurriculum } from "@/lib/curriculum-merge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The loud half of the curriculum override layer.
 *
 * /coach/fall-playbook reads overrides fail-soft and SILENT — a run sheet must
 * render on a Sunday whatever Notion is doing. That silence is only safe if
 * something else is watching, which is this: once a day it re-runs the same
 * read plus the same merge and alerts on the two things a coach cannot see
 * from the page — a failed query (edits silently reverted) and a Field ID that
 * resolves to nothing (an edit that never landed).
 *
 * Ships dark with the feature: NOTION_CURRICULUM_DB_ID unset is reported as
 * dark, not as a failure. Auth = Bearer CRON_SECRET.
 */
export const GET = withCronAlert("curriculum-health", async () => {
  const result = await fetchCurriculumOverrides();
  const merged = mergeCurriculum(CURRICULUM_DEFAULTS, result.overrides);
  const failures = curriculumHealthFailures(result, merged.unknownFieldIds);

  return {
    attempted: result.overrides.length,
    succeeded: merged.editedFieldIds.size,
    failures,
    body: {
      status: result.status,
      dark: result.status === "config_missing",
      overrideRows: result.overrides.length,
      applied: merged.editedFieldIds.size,
      unknownFieldIds: merged.unknownFieldIds,
    },
  };
});
