import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import OpsSendSummary from "../src/components/OpsSendSummary";

const require = createRequire(`${process.cwd()}/package.json`);
const runtime = require("playwright/jsx-runtime");
const originalRuntime = { ...runtime };
test.beforeEach(() => Object.assign(runtime, { jsx: jsx.jsx, jsxs: jsx.jsxs, Fragment: jsx.Fragment }));
test.afterEach(() => Object.assign(runtime, originalRuntime));

test("successful delivery with failed CRM tells the coach to repair only", () => {
  const html = renderToStaticMarkup(OpsSendSummary({ body: { success: true, sent_to: "parent@example.org", notion_updated: false }, hasFailedEmails: false }));
  expect(html).toContain("Sent to parent@example.org");
  expect(html).toContain("CRM update failed");
  expect(html).toContain("Repair the CRM record only");
  expect(html).toContain("do not resend");
  expect(html).toContain("text-ngpa-red");
  expect(html).not.toContain("fresh preview before sending again");
});

test("successful delivery and CRM keep the ordinary sent confirmation", () => {
  const html = renderToStaticMarkup(OpsSendSummary({ body: { sent_to: "parent@example.org", notion_updated: true }, hasFailedEmails: false }));
  expect(html).toContain("text-ngpa-skill-green");
  expect(html).not.toContain("CRM update failed");
});

test("unrelated partial blasts keep counts and the existing retry guidance", () => {
  const html = renderToStaticMarkup(OpsSendSummary({ body: { sent: 3, failed: 1 }, hasFailedEmails: true }));
  expect(html).toContain("Sent 3, failed 1");
  expect(html).toContain("text-ngpa-red");
  expect(html).toContain("fresh preview");
  expect(html).not.toContain("CRM update failed");
});
