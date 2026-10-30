import { NextRequest, NextResponse } from "next/server";
import { activeSeriesRelease } from "@/data/mvf-series-registration";
import { findMvfJuniorSeriesEvent } from "@/data/mvf-junior-series";
import { createRateLimiter, getClientIp } from "./rate-limit";
import { mvfSeriesService, SeriesInputError } from "./mvf-series-service";
import { SeriesError } from "./mvf-series-store";
import { siteOrigin } from "./site-origin";

const limits = { register: createRateLimiter({ limit: 20 }), receipt: createRateLimiter({ limit: 60 }), cancel: createRateLimiter({ limit: 10 }) };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

export async function handleSeriesRequest(request: NextRequest, event: string, action: "register" | "receipt" | "cancel") {
  if (!findMvfJuniorSeriesEvent(event)) return reply({ code: "unknown_event" }, 404);
  if (action === "register" && !activeSeriesRelease(event)) return reply({ code: "registration_closed", error: "Registration is not open yet." }, 409);
  if (request.headers.get("origin") && request.headers.get("origin") !== siteOrigin()) return reply({ code: "invalid_origin" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ code: "json_required" }, 415);
  if (limits[action].isRateLimited(getClientIp(request))) return reply({ code: "rate_limited" }, 429);
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 12000) return reply({ code: "too_large" }, 413);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return reply({ code: "invalid_json" }, 400); }
    if (action === "register") return reply(await mvfSeriesService.register(event, input));
    const token = input && typeof input === "object" ? (input as { token?: unknown }).token : undefined;
    return reply(await mvfSeriesService[action](event, token));
  } catch (error) {
    if (error instanceof SeriesInputError) return reply({ code: error.code, errors: error.errors }, error.status);
    if (error instanceof SeriesError) return reply({ code: error.code, ...(error.code === "waiver_required" ? { signUrl: `/waiver/sign?next=${encodeURIComponent(`/mvf-junior-tournament/${event}`)}` } : {}) }, error.status);
    console.error("[mvf-series] operation requires verification", { action, event });
    return reply({ code: "verification_required" }, 503);
  }
}
