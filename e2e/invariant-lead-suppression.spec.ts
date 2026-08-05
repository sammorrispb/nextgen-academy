import { test, expect } from "@playwright/test";
import { classifyLead, type LeadRow } from "../src/lib/lead-segmentation";
import {
  resolveFamilyBucket,
  type FamilyBucket,
} from "../src/lib/lead-family-bucket";
import {
  signLeadConsentToken,
  verifyLeadConsentToken,
} from "../src/lib/lead-consent-token";

/**
 * INVARIANT: nobody who asked to stop hearing from us is ever mailed again,
 * and a consent link can never be replayed as the opposite action.
 *
 * These are the load-bearing guarantees behind the Aug-2026 permission-pass
 * blast, which deliberately widens the audience to DD-derived families. Widening
 * the audience makes the suppression path the ONLY thing standing between an
 * opt-out and a re-mail, so it is pinned here rather than left to the caller.
 */

function row(over: Partial<LeadRow> = {}): LeadRow {
  return {
    parentEmail: "parent@example.org",
    source: "Website",
    crEventsAttended: null,
    crEventHistory: "",
    lastCrEvent: "",
    season: "",
    notes: "",
    quarantine: false,
    ...over,
  };
}

test.describe("classifyLead — opt-out vs DD provenance are distinguishable", () => {
  test("quarantine is off_limits AND tagged opt_out", () => {
    const c = classifyLead(row({ quarantine: true }));
    expect(c.bucket).toBe("off_limits");
    expect(c.offLimitsKind).toBe("opt_out");
  });

  test("DD provenance is off_limits AND tagged dd_derived", () => {
    for (const over of [
      { source: "Google Sheet" },
      { source: "CourtReserve" },
      { crEventsAttended: 3 },
      { crEventHistory: "Orange Ball 2/8" },
      { lastCrEvent: "Red Ball" },
      { season: "Fall 2025" },
      { notes: "came via Dill Dinkers" },
    ]) {
      const c = classifyLead(row(over));
      expect(c.bucket, JSON.stringify(over)).toBe("off_limits");
      expect(c.offLimitsKind, JSON.stringify(over)).toBe("dd_derived");
    }
  });

  test("quarantine beats DD provenance — an opt-out is never re-labelled", () => {
    // A quarantined DD row must read as opt_out, not dd_derived. Otherwise a
    // send that opts into DD-derived families would sweep the opt-out back in.
    const c = classifyLead(row({ quarantine: true, source: "Google Sheet" }));
    expect(c.offLimitsKind).toBe("opt_out");
  });

  test("clean rows carry no offLimitsKind", () => {
    expect(classifyLead(row()).offLimitsKind).toBeUndefined();
    expect(classifyLead(row({ source: "" })).offLimitsKind).toBeUndefined();
  });
});

test.describe("resolveFamilyBucket — suppression is per FAMILY, not per row", () => {
  const unsubbed = new Set<string>(["gone@example.org"]);

  function bucket(rows: LeadRow[], email = "parent@example.org"): FamilyBucket {
    return resolveFamilyBucket(email, rows, unsubbed);
  }

  test("one quarantined row suppresses the whole family", () => {
    // The bug this pins: classifying row-by-row and skipping off_limits rows
    // lets a family with any one clean row through, so an opt-out recorded on
    // a duplicate row is silently ignored.
    expect(bucket([row({ quarantine: true }), row()])).toBe("suppressed");
    expect(bucket([row(), row({ quarantine: true })])).toBe("suppressed");
  });

  test("a newsletter unsubscribe suppresses the family even with clean rows", () => {
    expect(bucket([row(), row()], "gone@example.org")).toBe("suppressed");
  });

  test("unsubscribe matching is case- and whitespace-insensitive", () => {
    expect(bucket([row()], "  GONE@Example.ORG ")).toBe("suppressed");
  });

  test("one DD row taints the family even alongside a clean Website row", () => {
    // Real data: joegadler@ / markyuen@ / laurenwheelerporter@ each have a
    // Website row AND a Google Sheet row.
    expect(bucket([row({ source: "Google Sheet" }), row()])).toBe("dd_derived");
  });

  test("eligible beats ambiguous when no DD or opt-out row exists", () => {
    expect(bucket([row({ source: "" }), row({ source: "Website" })])).toBe(
      "eligible",
    );
  });

  test("all-ambiguous family stays ambiguous", () => {
    expect(bucket([row({ source: "" }), row({ source: "Referral" })])).toBe(
      "ambiguous",
    );
  });

  test("suppression outranks every other signal", () => {
    expect(
      bucket([
        row({ source: "Website" }),
        row({ source: "Google Sheet" }),
        row({ quarantine: true }),
      ]),
    ).toBe("suppressed");
  });
});

test.describe("lead consent token — actions cannot be swapped", () => {
  const SECRET = "test-consent-secret-value";
  const prev = process.env.LEAD_CONSENT_SECRET;
  test.beforeAll(() => {
    process.env.LEAD_CONSENT_SECRET = SECRET;
  });
  test.afterAll(() => {
    if (prev === undefined) delete process.env.LEAD_CONSENT_SECRET;
    else process.env.LEAD_CONSENT_SECRET = prev;
  });

  test("round-trips the email for the action it was signed for", () => {
    const t = signLeadConsentToken("Parent@Example.org", "subscribe");
    expect(t).toBeTruthy();
    expect(verifyLeadConsentToken(t!, "subscribe")).toBe("parent@example.org");
  });

  test("a subscribe token does NOT verify as an opt-out", () => {
    // Without action binding, a leaked/guessed 'yes' link could be replayed to
    // silently remove someone — or worse, an opt-out link replayed as consent.
    const t = signLeadConsentToken("parent@example.org", "subscribe")!;
    expect(verifyLeadConsentToken(t, "optout")).toBeNull();
  });

  test("an opt-out token does NOT verify as consent", () => {
    const t = signLeadConsentToken("parent@example.org", "optout")!;
    expect(verifyLeadConsentToken(t, "subscribe")).toBeNull();
  });

  test("tampered payload and tampered mac both fail", () => {
    const t = signLeadConsentToken("parent@example.org", "optout")!;
    const [payload, mac] = t.split(".");
    const other = Buffer.from("optout:evil@example.org", "utf-8").toString(
      "base64url",
    );
    expect(verifyLeadConsentToken(`${other}.${mac}`, "optout")).toBeNull();
    expect(verifyLeadConsentToken(`${payload}.AAAA`, "optout")).toBeNull();
    expect(verifyLeadConsentToken("garbage", "optout")).toBeNull();
    expect(verifyLeadConsentToken("", "optout")).toBeNull();
  });

  test("fails closed when no signing secret is configured", () => {
    delete process.env.LEAD_CONSENT_SECRET;
    const prevAdmin = process.env.NGA_ADMIN_SECRET;
    delete process.env.NGA_ADMIN_SECRET;
    expect(signLeadConsentToken("parent@example.org", "optout")).toBeNull();
    expect(verifyLeadConsentToken("a.b", "optout")).toBeNull();
    process.env.LEAD_CONSENT_SECRET = SECRET;
    if (prevAdmin !== undefined) process.env.NGA_ADMIN_SECRET = prevAdmin;
  });
});
