import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { isMvfParentContactRequest, mvfParentContactsConfigured, readMvfParentContacts } from "@/lib/mvf-parent-contacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 16384;

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
}

async function readBody(req: NextRequest): Promise<{ input: unknown; status: number }> {
  const declared = req.headers.get("content-length");
  if (declared !== null) {
    if (!/^(0|[1-9][0-9]*)$/.test(declared)) return { input: null, status: 400 };
    if (Number(declared) > MAX_BODY_BYTES) return { input: null, status: 413 };
  }
  const reader = req.body?.getReader();
  if (!reader) return { input: null, status: 400 };
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return { input: null, status: 413 };
      }
      chunks.push(value);
    }
    return { input: JSON.parse(Buffer.concat(chunks).toString("utf8")), status: 200 };
  } catch {
    return { input: null, status: 400 };
  } finally {
    reader.releaseLock();
  }
}

export async function POST(req: NextRequest) {
  if (!mvfParentContactsConfigured()) return json(503, { error: "not_configured" });
  if (!secretEquals(req.headers.get("x-nga-sync-secret"), process.env.NGA_SYNC_SECRET)) {
    return json(401, { error: "unauthorized" });
  }
  // This is a server-to-server surface. Browser calls and CORS are not part
  // of the approved contact projection; organizer auth happens on L&D.
  if (req.headers.has("origin")) return json(403, { error: "bad_origin" });
  if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return json(400, { error: "bad_input" });
  }
  const { input, status } = await readBody(req);
  if (status !== 200) return json(status, { error: status === 413 ? "body_too_large" : "bad_input" });
  if (!isMvfParentContactRequest(input)) return json(400, { error: "bad_input" });
  try {
    return json(200, await readMvfParentContacts(input.event_key, input.sync_keys, input.registration_refs));
  } catch {
    return json(502, { error: "contact_lookup_failed" });
  }
}
