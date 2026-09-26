import { test, expect } from "@playwright/test";
import { FALL_RAIN_DATES, FALL_SUNDAYS } from "../src/data/fall-2026";
import {
  FALL_CALL_BLOCKS,
  FALL_WEATHER_CALL_POLICY,
  applyCall,
  buildFallCalendar,
  cupfBookingLine,
  focusDate,
  normalizeCallStatus,
  normalizeCupfStatus,
  parseExtraEmails,
  sessionOn,
  weatherCallTime,
  whatsAppCallText,
  whatsAppShareUrl,
  type FallCallRecord,
} from "../src/lib/fall-calls";
import {
  fallWeatherCancelHtml,
  fallWeatherCancelSubject,
  fallWeatherCancelText,
} from "../src/lib/email/fall-weather-cancel";

// The weather-call calendar: Sam's rules as data. A cancelled session goes to
// the NEXT OPEN rain date for that group; calls are two hours before each
// group starts; a Sunday nobody marked is counted as held once it's past.

const [W1, W2, W3, W4, W5, W6] = FALL_SUNDAYS;
const [R1, R2] = FALL_RAIN_DATES;

function cancel(date: string, ...groups: ("Green" | "Yellow")[]): FallCallRecord {
  return { date, status: Object.fromEntries(groups.map((g) => [g, "Cancelled"])) };
}

function group(cal: ReturnType<typeof buildFallCalendar>, g: "Green" | "Yellow") {
  return cal.groups.find((x) => x.group === g)!;
}

test.describe("weather call times", () => {
  test("two hours before each group starts: Green 11:00 AM, Yellow 12:30 PM", () => {
    expect(weatherCallTime("1:00 PM")).toBe("11:00 AM");
    expect(weatherCallTime("2:30 PM")).toBe("12:30 PM");
    expect(FALL_CALL_BLOCKS.map((b) => [b.group, b.callTime])).toEqual([
      ["Green", "11:00 AM"],
      ["Yellow", "12:30 PM"],
    ]);
  });

  test("handles noon and morning starts", () => {
    expect(weatherCallTime("12:00 PM")).toBe("10:00 AM");
    expect(weatherCallTime("10:15 AM")).toBe("8:15 AM");
    expect(weatherCallTime("2:00 PM", 1)).toBe("1:00 PM");
    expect(() => weatherCallTime("1pm")).toThrow();
  });

  test("the policy sentence names both groups' call times", () => {
    expect(FALL_WEATHER_CALL_POLICY).toContain("two hours before");
    expect(FALL_WEATHER_CALL_POLICY).toContain("11:00 AM for Green Ball");
    expect(FALL_WEATHER_CALL_POLICY).toContain("12:30 PM for Yellow Ball");
  });
});

test.describe("status parsing is safe on hand-typed Notion values", () => {
  test("any spelling of cancelled reads as Cancelled — never as on", () => {
    for (const raw of ["Cancelled", "Canceled", "cancelled — weather", "Rained out", "Called off"]) {
      expect(normalizeCallStatus(raw), raw).toBe("Cancelled");
    }
    expect(normalizeCallStatus("Held")).toBe("Held");
    expect(normalizeCallStatus("On")).toBe("Held");
    expect(normalizeCallStatus("")).toBe("Scheduled");
    expect(normalizeCallStatus(undefined)).toBe("Scheduled");
    expect(normalizeCallStatus("Scheduled")).toBe("Scheduled");
  });

  test("CUPF status", () => {
    expect(normalizeCupfStatus("Booked")).toBe("Booked");
    expect(normalizeCupfStatus("Requested")).toBe("Requested");
    expect(normalizeCupfStatus("")).toBe("Not booked");
  });
});

test.describe("the derived season calendar", () => {
  test("no calls yet: six Sundays each, no rain dates claimed, nothing to book", () => {
    const cal = buildFallCalendar([], "2026-09-19");
    for (const g of cal.groups) {
      expect(g.sessions.map((s) => s.date)).toEqual([...FALL_SUNDAYS]);
      expect(g.remaining).toBe(6);
      expect(g.unresolved).toEqual([]);
    }
    expect(cal.rainDates.every((r) => r.usedBy.length === 0 && !r.needsBooking)).toBe(true);
  });

  test("a cancelled Sunday claims the first rain date for THAT group only", () => {
    const cal = buildFallCalendar([cancel(W2, "Green")], W2);
    const green = group(cal, "Green");
    const yellow = group(cal, "Yellow");

    expect(sessionOn(cal, "Green", W2)?.makeupDate).toBe(R1);
    expect(green.sessions.map((s) => s.date)).toEqual([...FALL_SUNDAYS, R1]);
    expect(sessionOn(cal, "Green", R1)?.makeupFor).toBe(W2);
    // Yellow played on — it has no rain-date session.
    expect(yellow.sessions.map((s) => s.date)).toEqual([...FALL_SUNDAYS]);
    expect(sessionOn(cal, "Yellow", R1)).toBeNull();

    const r1 = cal.rainDates.find((r) => r.date === R1)!;
    expect(r1.usedBy).toEqual([{ group: "Green", makeupFor: W2 }]);
    expect(r1.needsBooking).toBe(true);
  });

  test("both groups rained out the same Sunday share one rain date", () => {
    const cal = buildFallCalendar([cancel(W2, "Green", "Yellow")], W2);
    expect(sessionOn(cal, "Green", W2)?.makeupDate).toBe(R1);
    expect(sessionOn(cal, "Yellow", W2)?.makeupDate).toBe(R1);
    expect(cal.rainDates.find((r) => r.date === R1)!.usedBy).toHaveLength(2);
    expect(cal.rainDates.find((r) => r.date === R2)!.usedBy).toHaveLength(0);
  });

  test("the second washout goes to the NEXT open rain date, not a booked one", () => {
    const cal = buildFallCalendar([cancel(W2, "Green"), cancel(W4, "Green")], W4);
    expect(sessionOn(cal, "Green", W2)?.makeupDate).toBe(R1);
    expect(sessionOn(cal, "Green", W4)?.makeupDate).toBe(R2);
  });

  test("a group whose first rain date is free takes it even if the other group used it", () => {
    // Green took Nov 1 for W2; Yellow's first washout (W3) still gets Nov 1 —
    // the court is booked 1–4 PM, so Yellow's slot on it is open.
    const cal = buildFallCalendar([cancel(W2, "Green"), cancel(W3, "Yellow")], W3);
    expect(sessionOn(cal, "Yellow", W3)?.makeupDate).toBe(R1);
    expect(cal.rainDates.find((r) => r.date === R1)!.usedBy.map((u) => u.group)).toEqual([
      "Green",
      "Yellow",
    ]);
  });

  test("a rained-out rain date rolls to the next one", () => {
    const cal = buildFallCalendar([cancel(W6, "Green"), cancel(R1, "Green")], R1);
    expect(sessionOn(cal, "Green", W6)?.makeupDate).toBe(R1);
    expect(sessionOn(cal, "Green", R1)?.makeupDate).toBe(R2);
    expect(group(cal, "Green").sessions.map((s) => s.date)).toEqual([...FALL_SUNDAYS, R1, R2]);
  });

  test("three washouts: the third has no rain date and is reported unresolved", () => {
    const cal = buildFallCalendar(
      [cancel(W2, "Yellow"), cancel(W3, "Yellow"), cancel(W5, "Yellow")],
      W5,
    );
    expect(sessionOn(cal, "Yellow", W5)?.makeupDate).toBeNull();
    expect(group(cal, "Yellow").unresolved).toEqual([W5]);
  });

  test("a rain-date row with no claiming cancellation is not a session", () => {
    const cal = buildFallCalendar([{ date: R2, status: { Green: "Held" } }], W1);
    expect(sessionOn(cal, "Green", R2)).toBeNull();
  });

  test("states: past unmarked = held, today = today, Held today = on, future = upcoming", () => {
    const cal = buildFallCalendar([{ date: W3, status: { Yellow: "Held" } }], W3);
    expect(sessionOn(cal, "Green", W1)?.state).toBe("held");
    expect(sessionOn(cal, "Green", W1)?.derivedHeld).toBe(true);
    expect(sessionOn(cal, "Green", W3)?.state).toBe("today");
    expect(sessionOn(cal, "Yellow", W3)?.state).toBe("on");
    expect(sessionOn(cal, "Green", W4)?.state).toBe("upcoming");
  });

  test("counts: held, cancelled and remaining add up after a washout", () => {
    const cal = buildFallCalendar([cancel(W2, "Green")], W3);
    const green = group(cal, "Green");
    expect(green.held).toBe(1); // W1
    expect(green.cancelled).toBe(1); // W2
    expect(green.remaining).toBe(5); // W3–W6 + Nov 1
  });

  test("a Booked rain date no longer needs booking", () => {
    const cal = buildFallCalendar([cancel(W2, "Green"), { date: R1, cupf: "Booked" }], W2);
    expect(cal.rainDates.find((r) => r.date === R1)!.needsBooking).toBe(false);
  });

  test("applyCall projects a call without mutating the input", () => {
    const records: FallCallRecord[] = [{ date: W2, status: { Yellow: "Held" } }];
    const next = applyCall(records, W2, ["Green"], "Cancelled");
    expect(records[0].status).toEqual({ Yellow: "Held" });
    expect(next[0].status).toEqual({ Yellow: "Held", Green: "Cancelled" });
  });

  test("focus date stays on a cancelled day for the whole day, then moves on", () => {
    const records = [cancel(W2, "Green", "Yellow")];
    expect(focusDate(buildFallCalendar(records, W2), W2)).toBe(W2);
    expect(focusDate(buildFallCalendar(records, "2026-09-28"), "2026-09-28")).toBe(W3);
    expect(focusDate(buildFallCalendar([], "2026-12-01"), "2026-12-01")).toBeNull();
  });
});

test.describe("WhatsApp + CUPF helpers", () => {
  test("the cancel post names the group, the day, the make-up and where to check", () => {
    const text = whatsAppCallText({
      group: "Green",
      date: W2,
      todayIso: W2,
      outcome: "cancelled",
      makeupDate: R1,
      note: "steady rain",
    });
    expect(text).toContain("Green Ball is CANCELLED today");
    expect(text).toContain("steady rain");
    expect(text).toContain("Sunday, November 1");
    expect(text).toContain("1:00–2:30 PM");
    expect(text).toContain("nextgenpbacademy.com/fall");
  });

  test("with no rain date left, the post says so instead of inventing one", () => {
    const text = whatsAppCallText({
      group: "Yellow",
      date: W5,
      todayIso: W5,
      outcome: "cancelled",
      makeupDate: null,
    });
    expect(text).toContain("Both rain dates are already in use");
    expect(text).not.toContain("Make-up:");
  });

  test("the go post", () => {
    const text = whatsAppCallText({ group: "Yellow", date: W3, todayIso: W3, outcome: "on" });
    expect(text).toContain("Yellow Ball is ON today");
    expect(text).toContain("2:30–4:00 PM");
  });

  test("share URL round-trips the text", () => {
    const url = whatsAppShareUrl("Line one\nLine & two");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe("Line one\nLine & two");
  });

  test("CUPF booking line is the whole 1:00–4:00 PM block", () => {
    expect(cupfBookingLine(R1)).toBe(
      "Walter Johnson High School tennis court · Sunday, November 1 · 1:00–4:00 PM",
    );
  });

  test("extra emails: lowercased, deduped, invalid ones returned not dropped", () => {
    expect(parseExtraEmails("A@x.org, a@x.org; b@y.com nope")).toEqual({
      valid: ["a@x.org", "b@y.com"],
      invalid: ["nope"],
    });
    expect(parseExtraEmails(undefined)).toEqual({ valid: [], invalid: [] });
  });
});

test.describe("the cancellation email", () => {
  const input = {
    firstName: "Dana",
    date: W2,
    todayIso: W2,
    groups: [{ group: "Green" as const, makeupDate: R1, remaining: [W3, W4, W5, W6, R1] }],
    note: "steady rain and wet courts",
  };

  test("subject says what and when, within 60 characters", () => {
    const subject = fallWeatherCancelSubject(input);
    expect(subject).toBe("Green Ball cancelled today (Sun, Sep 27) — weather");
    expect(subject.length).toBeLessThanOrEqual(60);
    const both = fallWeatherCancelSubject({
      ...input,
      groups: [...input.groups, { group: "Yellow", makeupDate: R1, remaining: [] }],
    });
    expect(both).toBe("Fall season cancelled today (Sun, Sep 27) — weather");
    expect(both.length).toBeLessThanOrEqual(60);
  });

  test("tells them not to come, when it's made up, and what's left", () => {
    const text = fallWeatherCancelText(input);
    expect(text).toContain("Please don't head to the courts");
    expect(text).toContain("steady rain and wet courts");
    expect(text).toContain("Green Ball: Sunday, November 1, 1:00–2:30 PM");
    expect(text).toContain("Sun, Oct 4 · Sun, Oct 11 · Sun, Oct 18 · Sun, Oct 25 · Sun, Nov 1");
    expect(text).toContain("nextgenpbacademy.com/fall");
  });

  test("out of rain dates → states the refund term, invents no date", () => {
    const text = fallWeatherCancelText({
      ...input,
      groups: [{ group: "Green", makeupDate: null, remaining: [W6] }],
    });
    expect(text).toContain("both rain dates are already in use");
    expect(text).toContain("refunded");
    expect(text).not.toContain("November");
  });

  test("the note is escaped in HTML", () => {
    const html = fallWeatherCancelHtml({ ...input, note: "<b>lightning</b>" });
    expect(html).toContain("&lt;b&gt;lightning&lt;/b&gt;");
    expect(html).not.toContain("<b>lightning</b>");
  });

  test("a cancellation made ahead of time names the date, not 'today'", () => {
    const subject = fallWeatherCancelSubject({ ...input, todayIso: "2026-09-26" });
    expect(subject).toBe("Green Ball cancelled Sun, Sep 27 — weather");
    expect(fallWeatherCancelText({ ...input, todayIso: "2026-09-26" })).toContain(
      "No Green Ball on Sunday, September 27",
    );
  });
});
