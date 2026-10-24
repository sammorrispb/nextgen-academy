import { test, expect } from "@playwright/test";
import { createServer } from "node:net";
import { forwardPrivatePreview, privatePreviewPost, transportProbeCode } from "./nga-parent-browser-transport";

async function closedLoopback(): Promise<string> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Synthetic loopback probe unavailable");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return `http://127.0.0.1:${address.port}/private-preview`;
}

test("intentional failed API transport produces only a sanitized error", async ({ request }, info) => {
  try { await privatePreviewPost(request, await closedLoopback(), { timeout: 1_000, headers: { authorization: `Bearer ${transportProbeCode()}` }, data: { preferences: {} } }); }
  catch (error) {
    await info.attach("sanitized-api-transport-error", { body: error instanceof Error ? error.message : "Transport unavailable", contentType: "text/plain" });
    throw error;
  }
});

test("intentional failed route transport produces only a controlled browser error", async ({ page }, info) => {
  const url = await closedLoopback();
  await page.route("**/private-preview", (route) => forwardPrivatePreview(route, "https://nextgenpbacademy.com", { url, headers: { authorization: `Bearer ${transportProbeCode()}` } }));
  let outcome = "unexpected_success";
  try { await page.goto(url, { timeout: 3_000 }); } catch { outcome = "read_only_transport_lost"; }
  await info.attach("sanitized-route-outcome", { body: outcome, contentType: "text/plain" });
  expect(outcome, "deliberately fail after the route callback to exercise failure reporters").toBe("intentional_failure_control");
});
