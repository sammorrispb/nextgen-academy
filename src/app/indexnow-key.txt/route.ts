// Serves the IndexNow ownership key — logic in src/lib/indexnow.ts.
import { indexNowKeyResponse } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return indexNowKeyResponse();
}
