import { test, expect } from "@playwright/test";
import { buildRosterMailto } from "../src/lib/roster-mailto";

const base = {
  sessionTitle: "Walter Johnson HS",
  prettyDate: "Sun, Jun 14",
  startTime: "10:00 AM",
  endTime: "11:00 AM",
  location: "Walter Johnson HS, 6400 Rock Spring Dr, Bethesda, MD 20814",
};

test.describe("buildRosterMailto", () => {
  test("no valid recipients yields null", () => {
    expect(buildRosterMailto({ ...base, emails: [] })).toBeNull();
    expect(buildRosterMailto({ ...base, emails: ["", "not-an-email"] })).toBeNull();
  });

  test("dedupes recipients case-insensitively into bcc", () => {
    const url = buildRosterMailto({
      ...base,
      emails: ["a@x.com", "A@x.com", "b@x.com"],
    });
    expect(url).toContain("bcc=a@x.com,b@x.com");
    expect(url!.startsWith("mailto:?bcc=")).toBe(true);
  });

  test("subject and body are URI-encoded and reference the session", () => {
    const url = buildRosterMailto({
      ...base,
      sessionTitle: "Red & Orange — Tuesday",
      emails: ["a@x.com"],
    })!;
    expect(url).not.toContain("Red & Orange");
    expect(decodeURIComponent(url)).toContain("Red & Orange — Tuesday");
    expect(decodeURIComponent(url)).toContain("Sun, Jun 14 at 10:00 AM–11:00 AM");
  });

  test("body venue uses only the first segment of the address", () => {
    const url = buildRosterMailto({ ...base, emails: ["a@x.com"] })!;
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("(Walter Johnson HS)");
    expect(decoded).not.toContain("Rock Spring");
  });
});
