import { test, expect } from "@playwright/test";

/**
 * Browser-driven proof of the fix reported live on 2026-08-16: hitting the
 * one-time-waiver gate used to navigate the parent to /waiver/sign, discarding
 * the whole registration, so signing led back to an EMPTY form and payment
 * never happened.
 *
 * Drives /fall with the network stubbed: the first checkout call returns the
 * gate's 409, the sign call succeeds, and the second checkout call must arrive
 * carrying the SAME payload the parent typed once. Browser-driven, so it is in
 * playwright.pure.config.ts's testIgnore and runs against `npm run dev`.
 *
 * Requires NEXT_PUBLIC_FALL_REGISTRATION_OPEN=true for the form to render;
 * skips cleanly when the season is dark rather than failing a dark deploy.
 */

const REG = {
  parentName: "Jordan Parent",
  email: "inline-waiver@example.com",
  phone: "301-555-0142",
  childFirstName: "Riley",
  childBirthYear: "2016",
  emergencyName: "Sam Contact",
  emergencyPhone: "301-555-0143",
  allergies: "Peanut allergy — carries an EpiPen",
};

test.describe("fall registration — waiver signed in place", () => {
  test("signing resumes checkout with nothing retyped", async ({ page }) => {
    const checkoutBodies: Record<string, string>[] = [];
    let signBody: Record<string, string> | null = null;

    // The gate is server-side: it keeps 409ing until a waiver is actually on
    // file, so the stub only clears once /api/waiver-sign has succeeded.
    let signed = false;

    await page.route("**/api/checkout-fall", async (route) => {
      checkoutBodies.push(route.request().postDataJSON());
      if (!signed) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Please sign the one-time waiver before registering.",
            code: "waiver_required",
            signUrl: "/waiver/sign?email=inline-waiver%40example.com",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        // Same-origin stand-in for the Stripe URL so the redirect is observable.
        body: JSON.stringify({ url: "/fall?stub_checkout=reached" }),
      });
    });

    await page.route("**/api/waiver-sign", async (route) => {
      signBody = route.request().postDataJSON();
      signed = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/fall");

    const groupRadio = page.locator('input[name="group"]').first();
    test.skip(
      (await groupRadio.count()) === 0,
      "Fall registration is dark here (NEXT_PUBLIC_FALL_REGISTRATION_OPEN unset)",
    );

    await groupRadio.check();
    await page.fill("#parentName", REG.parentName);
    await page.fill("#email", REG.email);
    await page.fill("#phone", REG.phone);
    await page.fill("#childFirstName", REG.childFirstName);
    await page.fill("#childBirthYear", REG.childBirthYear);
    await page.fill("#emergencyName", REG.emergencyName);
    await page.fill("#emergencyPhone", REG.emergencyPhone);
    await page.fill("#allergies", REG.allergies);

    await page.getByRole("button", { name: /Register for the season/i }).click();

    // The gate opens the waiver IN PLACE — no navigation off /fall.
    const signature = page.locator("#waiverSignatureName");
    await expect(signature).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/fall");

    // The parent's details are still held, not discarded.
    await page.getByRole("button", { name: /Back to your details/i }).click();
    await expect(page.locator("#childFirstName")).toHaveValue(
      REG.childFirstName,
    );
    await expect(page.locator("#allergies")).toHaveValue(REG.allergies);

    // Back into the waiver and sign it.
    await page.getByRole("button", { name: /Register for the season/i }).click();
    await expect(signature).toBeVisible();
    await signature.fill("Jordan A Parent");
    await page.getByRole("checkbox").last().check();
    await page
      .getByRole("button", { name: /Sign & continue to payment/i })
      .click();

    // Checkout resumes on its own and reaches the payment redirect.
    await page.waitForURL(/stub_checkout=reached/);

    // Two blocked attempts (before and after the back-to-details detour), then
    // the resume that goes through.
    expect(checkoutBodies).toHaveLength(3);
    const resumed = checkoutBodies[checkoutBodies.length - 1];
    // The resume must carry exactly what the parent typed once.
    expect(resumed).toMatchObject({
      parentName: REG.parentName,
      email: REG.email,
      childFirstName: REG.childFirstName,
      childBirthYear: REG.childBirthYear,
      emergencyName: REG.emergencyName,
      allergies: REG.allergies,
    });
    for (const body of checkoutBodies) expect(body).toEqual(resumed);

    // The signature is the parent's own; contact details ride along from the
    // registration rather than being asked for a second time.
    expect(signBody).toMatchObject({
      parentName: REG.parentName,
      email: REG.email,
      signatureName: "Jordan A Parent",
      agree: true,
    });
    // No child field is ever sent to the waiver route — it stays parent-scoped.
    expect(Object.keys(signBody ?? {})).not.toContain("childFirstName");
    expect(Object.keys(signBody ?? {})).not.toContain("childBirthYear");
    expect(Object.keys(signBody ?? {})).not.toContain("allergies");
  });
});
