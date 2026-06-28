import { test, expect } from "@playwright/test";
import { CLUSTERS } from "../src/data/clusters";
import {
  CLUSTER_LAUNCH_GATES,
  isClusterLaunchable,
  resolveClusterCheckoutGate,
} from "../src/data/cluster-launch-gates";
import {
  ageAsOfSeptFirst,
  resolveClusterBand,
  SEASON_YEAR,
} from "../src/lib/cluster-age";
import { resolveClusterRefundCents } from "../src/lib/cluster-refund";
import {
  validateClusterForm,
  isDuplicateClusterRegistration,
  type ClusterFormData,
} from "../src/lib/validate-cluster";

// Pure-function specs — no dev server needed:
//   npx playwright test e2e/cluster-registration.spec.ts --project=desktop

const VALID_FORM: ClusterFormData = {
  clusterSlug: "down-county",
  parentName: "Jordan Parent",
  email: "jordan@example.com",
  phone: "301-555-0100",
  childFirstName: "Casey",
  childBirthDate: "2014-04-12",
  ballLevel: "Green",
  emergencyName: "Alex Backup",
  emergencyPhone: "301-555-0101",
  allergies: "",
  smsConsent: false,
  displayConsent: false,
};

test.describe("cluster launch gates", () => {
  test("every cluster has a gates entry", () => {
    for (const c of CLUSTERS) {
      expect(CLUSTER_LAUNCH_GATES[c.slug]).toBeDefined();
    }
  });

  test("all gates ship false (pre-launch guard is mechanical, not a comment)", () => {
    for (const c of CLUSTERS) {
      expect(isClusterLaunchable(c.slug)).toBe(false);
    }
  });

  test("checkout gate blocks when any gate is false or the price env is missing", () => {
    const closed = resolveClusterCheckoutGate(
      { coachConfirmed: false, venueConfirmed: true },
      "price_123",
    );
    expect(closed.ok).toBe(false);
    if (!closed.ok) expect(closed.status).toBe(503);

    const noVenue = resolveClusterCheckoutGate(
      { coachConfirmed: true, venueConfirmed: false },
      "price_123",
    );
    expect(noVenue.ok).toBe(false);

    const noPrice = resolveClusterCheckoutGate(
      { coachConfirmed: true, venueConfirmed: true },
      undefined,
    );
    expect(noPrice.ok).toBe(false);

    const open = resolveClusterCheckoutGate(
      { coachConfirmed: true, venueConfirmed: true },
      "price_123",
    );
    expect(open.ok).toBe(true);
  });

  test("blocked checkout points families at the interest list, not a dead end", () => {
    const closed = resolveClusterCheckoutGate(
      { coachConfirmed: false, venueConfirmed: false },
      undefined,
    );
    expect(closed.ok).toBe(false);
    if (!closed.ok) expect(closed.message.toLowerCase()).toContain("interest");
  });
});

test.describe("cluster age bands (age as of Sept 1, season year)", () => {
  test("kid turning 13 on Oct 2 of season year is still U12 for Fall", () => {
    expect(ageAsOfSeptFirst(`${SEASON_YEAR - 13}-10-02`)).toBe(12);
    expect(resolveClusterBand(`${SEASON_YEAR - 13}-10-02`)).toBe("U12");
  });

  test("kid who turned 13 before Sept 1 is U14", () => {
    expect(resolveClusterBand(`${SEASON_YEAR - 13}-08-15`)).toBe("U14");
  });

  test("Sept 1 birthday counts as already that age", () => {
    expect(ageAsOfSeptFirst(`${SEASON_YEAR - 10}-09-01`)).toBe(10);
    expect(resolveClusterBand(`${SEASON_YEAR - 10}-09-01`)).toBe("U12");
    expect(resolveClusterBand(`${SEASON_YEAR - 14}-09-01`)).toBe("U14");
  });

  test("9-year-olds and 15-year-olds are out of band", () => {
    expect(resolveClusterBand(`${SEASON_YEAR - 9}-01-15`)).toBeNull();
    expect(resolveClusterBand(`${SEASON_YEAR - 15}-01-15`)).toBeNull();
  });

  test("garbage birthdates resolve to no band, never throw", () => {
    expect(resolveClusterBand("not-a-date")).toBeNull();
    expect(resolveClusterBand("")).toBeNull();
    expect(resolveClusterBand("2014-13-45")).toBeNull();
    expect(resolveClusterBand("14/04/2014")).toBeNull();
  });
});

test.describe("cluster refunds", () => {
  test("min-size miss is always a full refund", () => {
    expect(
      resolveClusterRefundCents({
        paidCents: 16000,
        reason: "min-size-miss",
        businessDaysBeforeStart: 0,
      }),
    ).toBe(16000);
  });

  test("parent cancel ≥10 business days out: full minus the $25 admin fee", () => {
    expect(
      resolveClusterRefundCents({
        paidCents: 16000,
        reason: "parent-cancel",
        businessDaysBeforeStart: 10,
      }),
    ).toBe(13500);
  });

  test("parent cancel under 10 business days: non-refundable", () => {
    expect(
      resolveClusterRefundCents({
        paidCents: 16000,
        reason: "parent-cancel",
        businessDaysBeforeStart: 9,
      }),
    ).toBe(0);
  });

  test("refund never goes negative on small payments", () => {
    expect(
      resolveClusterRefundCents({
        paidCents: 2000,
        reason: "parent-cancel",
        businessDaysBeforeStart: 30,
      }),
    ).toBe(0);
  });
});

test.describe("cluster form validation", () => {
  test("a complete valid form passes", () => {
    expect(validateClusterForm(VALID_FORM)).toEqual({});
  });

  test("unknown cluster slug and legacy color slugs are rejected", () => {
    expect(validateClusterForm({ ...VALID_FORM, clusterSlug: "teal" }).clusterSlug).toBeTruthy();
    expect(validateClusterForm({ ...VALID_FORM, clusterSlug: "nope" }).clusterSlug).toBeTruthy();
  });

  test("out-of-band and malformed birthdates are rejected with a visible message", () => {
    const tooYoung = validateClusterForm({
      ...VALID_FORM,
      childBirthDate: `${SEASON_YEAR - 9}-01-15`,
    });
    expect(tooYoung.childBirthDate).toBeTruthy();
    const garbage = validateClusterForm({ ...VALID_FORM, childBirthDate: "garbage" });
    expect(garbage.childBirthDate).toBeTruthy();
  });

  test("cluster group play is Green/Yellow ball only (Red/Orange routes to private lessons)", () => {
    expect(validateClusterForm({ ...VALID_FORM, ballLevel: "Red" }).ballLevel).toBeTruthy();
    expect(validateClusterForm({ ...VALID_FORM, ballLevel: "Orange" }).ballLevel).toBeTruthy();
    expect(validateClusterForm({ ...VALID_FORM, ballLevel: "Yellow" }).ballLevel).toBeUndefined();
  });

  test("missing contact fields are each named", () => {
    const empty = validateClusterForm({});
    for (const key of [
      "clusterSlug",
      "parentName",
      "email",
      "phone",
      "childFirstName",
      "childBirthDate",
      "emergencyName",
      "emergencyPhone",
    ] as const) {
      expect(empty[key]).toBeTruthy();
    }
  });

  test("displayConsent defaults to false when omitted (privacy opt-IN, never opt-out)", () => {
    const withoutConsent: Partial<ClusterFormData> = { ...VALID_FORM };
    delete withoutConsent.displayConsent;
    expect(validateClusterForm(withoutConsent)).toEqual({});
  });
});

test.describe("duplicate registration guard", () => {
  const existing = [
    { childFirstName: "Casey", parentEmail: "jordan@example.com", clusterSlug: "down-county" },
  ];

  test("same child + parent + cluster is a duplicate (case/space-insensitive)", () => {
    expect(
      isDuplicateClusterRegistration(existing, {
        childFirstName: "  casey ",
        parentEmail: "JORDAN@example.com",
        clusterSlug: "down-county",
      }),
    ).toBe(true);
  });

  test("same family in a different cluster, or a sibling, is not a duplicate", () => {
    expect(
      isDuplicateClusterRegistration(existing, {
        childFirstName: "Casey",
        parentEmail: "jordan@example.com",
        clusterSlug: "up-county",
      }),
    ).toBe(false);
    expect(
      isDuplicateClusterRegistration(existing, {
        childFirstName: "Riley",
        parentEmail: "jordan@example.com",
        clusterSlug: "down-county",
      }),
    ).toBe(false);
  });
});
