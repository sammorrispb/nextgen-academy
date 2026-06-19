import { test, expect } from "@playwright/test";
import { buildDraftsQueryFilter } from "../src/lib/notion-newsletter-drafts";

// Pure unit test (no network) for the Notion query filter that guards the
// weekly newsletter's "From Coach Sam" lead block: only Approved rows inside
// the 7-day Drafted At window whose Expires At hasn't passed should ship.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findCondition(and: any[], property: string, key: string): any {
  return and.find((c) => c?.property === property && c?.date?.[key] !== undefined);
}

test.describe("buildDraftsQueryFilter", () => {
  const filter = buildDraftsQueryFilter("2026-06-11", "2026-06-18");

  test("AND includes Status=Approved", () => {
    const status = filter.and.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => c?.property === "Status",
    );
    expect(status).toEqual({
      property: "Status",
      select: { equals: "Approved" },
    });
  });

  test("AND includes Drafted At on_or_after the cutoff", () => {
    const drafted = findCondition(filter.and, "Drafted At", "on_or_after");
    expect(drafted).toEqual({
      property: "Drafted At",
      date: { on_or_after: "2026-06-11" },
    });
  });

  test("AND includes an OR with both Expires At branches (empty + on_or_after today)", () => {
    const orClause = filter.and.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => Array.isArray(c?.or),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as { or: any[] } | undefined;
    expect(orClause).toBeTruthy();
    if (!orClause) throw new Error("missing OR clause");

    const isEmptyBranch = orClause.or.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b: any) => b?.property === "Expires At" && b?.date?.is_empty === true,
    );
    expect(isEmptyBranch).toEqual({
      property: "Expires At",
      date: { is_empty: true },
    });

    const onOrAfterBranch = orClause.or.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b: any) =>
        b?.property === "Expires At" && b?.date?.on_or_after !== undefined,
    );
    expect(onOrAfterBranch).toEqual({
      property: "Expires At",
      date: { on_or_after: "2026-06-18" },
    });
  });
});
