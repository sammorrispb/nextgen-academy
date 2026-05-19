import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const APP = "nextgen-academy";

const REQUIRED_ENV = [
  "NOTION_API_KEY",
  "NOTION_SESSIONS_DB_ID",
  "NOTION_DROPINS_DB_ID",
  "NOTION_WAITLIST_DB_ID",
  "NOTION_INSTITUTIONAL_DB_ID",
  "NOTION_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_DROPIN_PRICE_ID",
  "NGA_ADMIN_SECRET",
  "NEXT_PUBLIC_SITE_URL",
  "OPEN_BRAIN_INGEST_URL",
  "LEAD_INGEST_TOKEN",
  "HEALTHCHECK_SECRET",
] as const;

type Probe = { name: string; ok: boolean; error?: string };

async function probeNotionDb(name: string, dbIdEnv: string): Promise<Probe> {
  const dbId = process.env[dbIdEnv];
  const apiKey = process.env.NOTION_API_KEY;
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { name, ok: false, error: `${res.status}: ${text.slice(0, 200)}` };
    }
    return { name, ok: true };
  } catch (err) {
    return {
      name,
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const expected = process.env.HEALTHCHECK_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
  const probes: Probe[] = [];
  if (missingEnv.length === 0) {
    probes.push(
      await probeNotionDb("notion:waitlist_db", "NOTION_WAITLIST_DB_ID"),
      await probeNotionDb("notion:institutional_db", "NOTION_INSTITUTIONAL_DB_ID"),
    );
  }

  const ok = missingEnv.length === 0 && probes.every((p) => p.ok);
  return NextResponse.json(
    {
      app: APP,
      status: ok ? "ok" : "degraded",
      env: { missing: missingEnv },
      probes,
      ts: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
