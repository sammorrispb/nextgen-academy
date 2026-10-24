import type { APIRequestContext, APIResponse, Route } from "@playwright/test";

export const transportProbeCode = () => `ngaj1.${Buffer.from("synthetic-transport-probe-only").toString("base64url")}.${"x".repeat(43)}`;

export async function privatePreviewPost(request: APIRequestContext, url: string, options: Parameters<APIRequestContext["post"]>[1]): Promise<APIResponse> {
  try { return await request.post(url, options); }
  // Playwright transport errors include headers/body in their Call log. Never
  // propagate the original error, stack or cause into reporters or artifacts.
  catch { throw new Error("Read-only preview transport failed. Retry the request."); }
}

export async function forwardPrivatePreview(route: Route, origin: string, options: { url?: string; headers?: Record<string, string>; loseResponse?: boolean } = {}): Promise<void> {
  try {
    const response = await route.fetch({ headers: { ...route.request().headers(), origin, ...options.headers }, ...(options.url ? { url: options.url } : {}), timeout: 5_000 });
    if (options.loseResponse) await route.abort(); else await route.fulfill({ response });
  } catch {
    // The caller observes an ordinary lost response. Callback rejection would
    // escape as an unhandled runner error containing the credential headers.
    await route.abort().catch(() => undefined);
  }
}
