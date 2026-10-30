import { test, expect } from "@playwright/test";
import { SeriesHarness } from "./fixtures/mvf-series";
const keys = ["STRIPE_SECRET_KEY", "NGA_SYNC_SECRET", "LINKDINK_BASE_URL", "VERCEL_ENV", "RESEND_API_KEY", "NOTION_API_KEY", "NOTION_MVF_SERIES_REGS_DB_ID", "NOTION_MVF_TOURNAMENT_REGS_DB_ID", "NOTION_WAIVERS_DB_ID"];
let saved: Record<string,string|undefined>, h: SeriesHarness;
test.beforeEach(async ({ page }) => {
  saved = Object.fromEntries(keys.map(key => [key, process.env[key]])); for (const key of keys) delete process.env[key];
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_offline_browser", NGA_SYNC_SECRET: "synthetic-local-secret", LINKDINK_BASE_URL: "https://series.example.invalid", RESEND_API_KEY: "synthetic-local-key", NOTION_API_KEY: "synthetic-local-key", NOTION_MVF_SERIES_REGS_DB_ID: "11111111-2222-4333-8444-555555555555", NOTION_WAIVERS_DB_ID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
  h = new SeriesHarness().install();
  // Browser boundary → real service/SDK and Notion adapters → offline providers.
  // No source admission switch is enabled in the server or production files.
  await page.route("**/api/mvf-series/*/*", async route => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const data = route.request().postDataJSON();
    try {
      const result = action === "register" ? await h.service.register("november-2026", data) : action === "receipt" ? await h.service.receipt("november-2026", data.token) : await h.service.cancel("november-2026", data.token);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
    } catch (error) {
      const value = error as { status?: number; code?: string; errors?: object };
      await route.fulfill({ status: value.status ?? 503, contentType: "application/json", body: JSON.stringify({ code: value.code ?? "unavailable", errors: value.errors }) });
    }
  });
});
test.afterEach(() => { const attempts = h.network.attempts.slice(); h.close(); for (const [key,value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } expect(attempts).toEqual([]); });

async function fill(page: import("@playwright/test").Page) {
  await page.goto("/browser-test-fixture/mvf-series");
  for (const [name,value] of [["Parent or guardian name","Synthetic Guardian"],["Parent email","guardian@example.invalid"],["Parent phone","2025550100"],["Player first name","Synthetic"],["Player last name","Fixture"],["Player date of birth","2016-02-20"],["Emergency contact name","Synthetic Backup"],["Emergency contact phone","2025550101"]]) await page.getByLabel(name,{exact:true}).fill(value);
  await page.getByLabel("I am the parent or guardian and accept these event policies.").check();
  await page.getByRole("button",{name:"Request invoice — $50",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Payment pending",exact:true})).toBeVisible();
}

test("guardian browser request, invoice, receipt and repeated paid callbacks",async({page})=>{
  await fill(page);
  expect(h.fake.all()).toHaveLength(1);expect(h.pages).toHaveLength(1);
  await expect(page.getByRole("link",{name:"Pay your invoice on Stripe"})).toHaveAttribute("href",/^https:\/\/invoice\.stripe\.com\//);
  const id=h.fake.all()[0].id;h.statuses.set(id,"paid");
  await h.service.webhook(h.event(id));await h.service.webhook(h.event(id,"invoice.payment_succeeded"));
  await page.getByRole("button",{name:"Check payment status again"}).click();
  await expect(page.getByRole("heading",{name:"Payment received — registration confirmed"})).toBeVisible();
  expect(h.mails).toHaveLength(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("guardian browser unpaid cancellation releases one seat and makes no refund",async({page})=>{
  await fill(page);
  await page.getByLabel("Cancel this unpaid invoice and release its seat.").check();
  await page.getByRole("button",{name:"Confirm unpaid cancellation"}).click();
  await expect(page.getByRole("heading",{name:"Unpaid registration cancelled"})).toBeVisible();
  expect(h.voids).toBe(1);expect([...h.seats.values()][0].state).toBe("void");expect(h.fake.all()).toHaveLength(1);
});
