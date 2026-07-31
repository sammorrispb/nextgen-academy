import { test, expect } from "@playwright/test";
import {
  fallSurveyHtml,
  fallSurveySubject,
  fallSurveyText,
  type FallSurveyInput,
} from "../src/lib/email/fall-survey";
import {
  fallInterestConfirmationHtml,
  fallInterestConfirmationSubject,
  fallInterestConfirmationText,
} from "../src/lib/email/fall-interest-confirmation";
import { FALL_NO_HOLD_NOTE } from "../src/data/fall-2026";

const FALL_URL = "https://nextgenpbacademy.com/fall";

function input(over: Partial<FallSurveyInput> = {}): FallSurveyInput {
  return {
    firstName: "Sam",
    variant: "nga",
    fallUrl: FALL_URL,
    unsubscribeUrl: null,
    ...over,
  };
}

const VARIANTS = ["nga", "ld"] as const;

test.describe("fall survey broadcast — both variants", () => {
  for (const variant of VARIANTS) {
    test(`${variant}: carries the season facts a reader needs to answer`, () => {
      const html = fallSurveyHtml(input({ variant }));
      const text = fallSurveyText(input({ variant }));

      for (const body of [html, text]) {
        // Venue, days, window, length.
        expect(body).toContain("Earle B. Wood");
        expect(body).toContain("Saturday");
        expect(body).toContain("Sunday");
        expect(body).toContain("5:00 PM");
        expect(body).toContain("7:00 PM");
        expect(body).toContain("September 12");
        expect(body).toContain("November 1");
        expect(body).toContain("8 weeks");
        // Terms.
        expect(body).toContain("9 ");
        expect(body).toMatch(/first come/i);
        expect(body).toMatch(/full season/i);
        expect(body).toMatch(/sub list/i);
        // The single CTA.
        expect(body).toContain(FALL_URL);
      }
    });

    test(`${variant}: describes BOTH programs — parents are invited to play`, () => {
      const html = fallSurveyHtml(input({ variant }));
      const text = fallSurveyText(input({ variant }));

      for (const body of [html, text]) {
        expect(body).toContain("Next Gen Youth Fall Season");
        expect(body).toContain("Link & Dink Fall Round Robin");
        // Youth format: practice hour then round robin hour.
        expect(body).toMatch(/one hour of coached practice/i);
        // Adult format: no practice hour.
        expect(body).toMatch(/no practice hour/i);
      }
    });

    test(`${variant}: quotes no price — pricing is teased, not quoted`, () => {
      const html = fallSurveyHtml(input({ variant }));
      const text = fallSurveyText(input({ variant }));
      const subject = fallSurveySubject(variant);

      // No dollar figure anywhere. The season has no Stripe product; the survey
      // ASKS what a season would be worth instead of anchoring a number.
      for (const body of [html, text, subject]) {
        expect(body, "a dollar figure leaked into the broadcast").not.toMatch(
          /\$\s?\d/,
        );
      }
    });

    test(`${variant}: never promises a held spot`, () => {
      const html = fallSurveyHtml(input({ variant }));
      const text = fallSurveyText(input({ variant }));

      for (const body of [html, text]) {
        expect(body).toContain(FALL_NO_HOLD_NOTE);
        expect(body).not.toMatch(/reserve your spot/i);
        expect(body).not.toMatch(/register now/i);
      }
    });

    test(`${variant}: greets the reader by first name`, () => {
      expect(fallSurveyHtml(input({ variant, firstName: "Jordan" }))).toContain(
        "Jordan",
      );
      expect(fallSurveyText(input({ variant, firstName: "Jordan" }))).toContain(
        "Jordan",
      );
    });
  }

  test("the two variants lead with different programs", () => {
    const nga = fallSurveyText(input({ variant: "nga" }));
    const ld = fallSurveyText(input({ variant: "ld" }));
    expect(nga).not.toEqual(ld);
    // Whichever program leads appears first in its own variant.
    expect(nga.indexOf("Next Gen Youth Fall Season")).toBeLessThan(
      nga.indexOf("Link & Dink Fall Round Robin"),
    );
    expect(ld.indexOf("Link & Dink Fall Round Robin")).toBeLessThan(
      ld.indexOf("Next Gen Youth Fall Season"),
    );
  });

  test("subjects differ per variant and name the season", () => {
    expect(fallSurveySubject("nga")).not.toEqual(fallSurveySubject("ld"));
    for (const v of VARIANTS) {
      expect(fallSurveySubject(v)).toMatch(/fall/i);
    }
  });

  test("an unsubscribe link renders only when one is supplied", () => {
    const withLink = fallSurveyHtml(
      input({ unsubscribeUrl: "https://nextgenpbacademy.com/api/newsletter/unsubscribe?token=t" }),
    );
    expect(withLink).toContain("token=t");
    expect(withLink).toMatch(/unsubscribe/i);

    // Lead-CRM recipients aren't on a subscription list — no link, no claim of one.
    const withoutLink = fallSurveyHtml(input({ unsubscribeUrl: null }));
    expect(withoutLink).not.toContain("/api/newsletter/unsubscribe");
  });

  test("the CTA link is UTM-stamped for attribution", () => {
    const html = fallSurveyHtml(
      input({ fallUrl: `${FALL_URL}?utm_source=email&utm_campaign=fall-2026-survey` }),
    );
    expect(html).toContain("utm_campaign=fall-2026-survey");
  });
});

test.describe("fall interest confirmation", () => {
  const base = {
    firstName: "Sam",
    tracks: ["youth"] as ("youth" | "adult")[],
    days: ["Saturday"],
    commitment: "Yes — full season, paid up front",
    subListInterest: true,
  };

  test("reflects back what the respondent told us", () => {
    const text = fallInterestConfirmationText(base);
    expect(text).toContain("Saturday");
    expect(text).toContain("Yes — full season, paid up front");
    expect(text).toMatch(/sub list/i);
  });

  test("says plainly that nothing is held", () => {
    expect(fallInterestConfirmationText(base)).toContain(FALL_NO_HOLD_NOTE);
    expect(fallInterestConfirmationHtml(base)).toContain(FALL_NO_HOLD_NOTE);
  });

  test("quotes no price", () => {
    expect(fallInterestConfirmationText(base)).not.toMatch(/\$\s?\d/);
    expect(fallInterestConfirmationHtml(base)).not.toMatch(/\$\s?\d/);
    expect(fallInterestConfirmationSubject()).not.toMatch(/\$\s?\d/);
  });

  test("never names the child — the confirmation is about the season, not the kid", () => {
    // The input type has no child field, so a caller can't put one in the
    // email even by passing one. Pinning it at runtime keeps a future "just
    // personalize it with the kid's name" change from silently widening the
    // surfaces a minor's name touches.
    const sneaky = {
      ...base,
      childFirstName: "Shouldnotappear",
      childLevel: "Yellow",
    } as typeof base;

    for (const body of [
      fallInterestConfirmationText(sneaky),
      fallInterestConfirmationHtml(sneaky),
    ]) {
      expect(body).not.toContain("Shouldnotappear");
    }
  });
});
