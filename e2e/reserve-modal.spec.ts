import { test, expect } from "@playwright/test";
import { REGISTRATION_WINDOW_DAYS } from "../src/data/schedule";

test.describe("Reserve modal — mobile QA", () => {
  test("opens and renders both consent checkboxes within viewport", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile-only smoke");

    // The real SessionCard/ReserveButton runs on a page injected only into
    // the runner's temporary workspace. Freeze the browser clock before load.
    await page.clock.setFixedTime(new Date("2026-10-02T12:00:00Z"));
    await page.goto("/browser-test-fixture/reservation");

    // The fixed sample session is inside its registration window.
    const reserve = page
      .getByRole("button", { name: "Reserve", exact: true })
      .first();
    await expect(reserve).toBeVisible();
    await reserve.click();

    // Dialog's aria-labelledby points to the session-title h3, not the eyebrow.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Reserve a Slot/)).toBeVisible();

    // Display-consent checkbox + its disclosure
    const displayConsent = dialog.locator('input[name="displayConsent"]');
    await expect(displayConsent).toBeVisible();
    await expect(displayConsent).not.toBeChecked();
    await expect(
      dialog.getByText(/Show my child.{1,3}s first name/i),
    ).toBeVisible();

    // SMS consent checkbox + the TCPA disclosure
    const smsConsent = dialog.locator('input[name="smsConsent"]');
    await expect(smsConsent).toBeVisible();
    await expect(smsConsent).not.toBeChecked();
    await expect(
      dialog.getByText(/I agree to receive text messages from Next Gen/i),
    ).toBeVisible();
    await expect(dialog.getByText(/Reply STOP to opt out/i)).toBeVisible();

    // Submit button reachable (scroll-into-view) and clickable
    const submit = dialog.getByRole("button", {
      name: /Continue to payment/,
    });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();

    // Viewport screenshot — modal as overlay
    await page.screenshot({
      path: testInfo.outputPath("modal-top.png"),
      fullPage: false,
    });

    // Scroll the dialog interior to the bottom to verify reachability of
    // the SMS-consent checkbox and the sticky Continue-to-payment footer.
    const scrollContainer = dialog;
    await scrollContainer.evaluate((el) => {
      el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
    });
    await page.screenshot({
      path: testInfo.outputPath("modal-bottom.png"),
      fullPage: false,
    });

    // Both consents AND the submit button must be reachable (in-viewport)
    // after the parent scrolls — regression guard for the sticky-footer trap
    // that hid the SMS-consent checkbox at 375×812.
    const smsBox = dialog.getByText(/I agree to receive text messages/i);
    const displayBox = dialog.getByText(/Show my child.{1,3}s first name/i);
    const sub = dialog.getByRole("button", { name: /Continue to payment/ });

    const [smsRect, displayRect, subRect] = await Promise.all([
      smsBox.boundingBox(),
      displayBox.boundingBox(),
      sub.boundingBox(),
    ]);
    expect(smsRect).not.toBeNull();
    expect(displayRect).not.toBeNull();
    expect(subRect).not.toBeNull();

    // Order: display-consent above SMS-consent above submit button.
    expect(displayRect!.y).toBeLessThan(smsRect!.y);
    expect(smsRect!.y).toBeLessThan(subRect!.y);

    // All three must fit within the 812 mobile viewport height after scroll.
    for (const r of [smsRect!, displayRect!, subRect!]) {
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.height).toBeLessThanOrEqual(812);
    }
  });
});


test.describe("Reservation fixture uses real availability behavior", () => {
  for (const [state, label] of [["full", "Full"], ["cancelled", "Cancelled"], ["outside-window", `Opens ${REGISTRATION_WINDOW_DAYS} days out`]]) {
    test(`${state} sessions cannot open checkout`, async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-10-02T12:00:00Z"));
      await page.goto(`/browser-test-fixture/reservation?state=${state}`);
      const reserve = page.getByRole("button", { name: label, exact: true });
      await expect(reserve).toBeVisible();
      await expect(reserve).toBeDisabled();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });
  }
});
