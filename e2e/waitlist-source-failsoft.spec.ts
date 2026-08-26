import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createNotionPageSourceFailSoft } from "../src/lib/notion-utils";

// The waitlist twin of e2e/notion-dropins.spec.ts's Source fail-soft.
//
// 2026-08-25: a real signup (parent + preferred area) emailed fine and never
// landed in Notion — the waitlist DB had no `Source` property, so the create
// 400'd with "Source is not a property that exists." and the row was lost.
// Same shape as the 2026-06-13 Landon incident on the drop-ins DB, which is
// why the retry now lives in ONE shared helper instead of per-route copies.
test.describe("createNotionPageSourceFailSoft", () => {
  const realFetch = globalThis.fetch;

  type Call = { propertyKeys: string[] };
  let calls: Call[];

  // Queue of responses the stub returns in order; each call shifts one.
  function stubFetch(
    responses: Array<{ ok: boolean; status: number; body?: string }>,
  ) {
    const queue = [...responses];
    globalThis.fetch = (async (_url: string, init?: { body?: string }) => {
      const parsed = init?.body ? JSON.parse(init.body) : {};
      calls.push({ propertyKeys: Object.keys(parsed.properties ?? {}) });
      const r = queue.shift() ?? { ok: false, status: 500, body: "{}" };
      return {
        ok: r.ok,
        status: r.status,
        text: async () => r.body ?? "",
        json: async () => ({ id: "page_test" }),
      };
    }) as unknown as typeof fetch;
  }

  function waitlistProperties() {
    return {
      "Parent Name": { title: [{ text: { content: "Test Parent" } }] },
      "Preferred Area": { select: { name: "Anywhere in MoCo" } },
      Status: { select: { name: "Active" } },
      "Marketing Opt-In": { checkbox: false },
      Source: { select: { name: "Website" } },
      "Parent Email": { email: "parent@example.com" },
    };
  }

  function run(properties: Record<string, unknown> = waitlistProperties()) {
    return createNotionPageSourceFailSoft({
      notionKey: "test-key",
      databaseId: "test-db",
      properties,
      logPrefix: "[waitlist-spec]",
    });
  }

  test.beforeEach(() => {
    calls = [];
  });

  test.afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("the exact 2026-08-25 rejection retries WITHOUT Source and the row lands", async () => {
    stubFetch([
      {
        ok: false,
        status: 400,
        body: '{"object":"error","status":400,"code":"validation_error","message":"Source is not a property that exists."}',
      },
      { ok: true, status: 200, body: "{}" },
    ]);

    const { res, droppedSource } = await run();

    expect(res.ok).toBe(true);
    expect(droppedSource).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0].propertyKeys).toContain("Source");
    expect(calls[1].propertyKeys).not.toContain("Source");
    // The retry still carries everything the waitlist row is FOR — the parent
    // and where they want to play. Dropping Source must not drop the family.
    expect(calls[1].propertyKeys).toContain("Parent Name");
    expect(calls[1].propertyKeys).toContain("Parent Email");
    expect(calls[1].propertyKeys).toContain("Preferred Area");
    expect(calls[1].propertyKeys).toContain("Status");
  });

  test("happy path writes Source once, no retry", async () => {
    stubFetch([{ ok: true, status: 200, body: "{}" }]);

    const { res, droppedSource } = await run();

    expect(res.ok).toBe(true);
    expect(droppedSource).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0].propertyKeys).toContain("Source");
  });

  test("a permanent rejection NOT about Source is not masked by the retry", async () => {
    stubFetch([
      { ok: false, status: 400, body: "Status is expected to be select." },
    ]);

    const { res, bodyText, droppedSource } = await run();

    expect(res.ok).toBe(false);
    expect(droppedSource).toBe(false);
    expect(bodyText).toContain("Status is expected to be select");
    expect(calls).toHaveLength(1); // no retry
  });

  test("transient failure is not retried as a Source problem", async () => {
    stubFetch([{ ok: false, status: 503, body: "service unavailable" }]);

    const { res, droppedSource } = await run();

    expect(res.ok).toBe(false);
    expect(droppedSource).toBe(false);
    expect(calls).toHaveLength(1);
  });

  test("no Source property in the payload → nothing to fail soft on", async () => {
    const props = waitlistProperties() as Record<string, unknown>;
    delete props.Source;
    stubFetch([{ ok: false, status: 400, body: "Source is not a property that exists." }]);

    const { res, droppedSource } = await run(props);

    expect(res.ok).toBe(false);
    expect(droppedSource).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

// Source-level pin: the waitlist route must go THROUGH the shared fail-soft.
// A future edit that re-inlines a raw `fetch(.../pages)` here would silently
// reopen the hole this spec exists to close.
test.describe("waitlist route wiring", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/api/waitlist/route.ts"),
    "utf8",
  );

  test("creates the row via createNotionPageSourceFailSoft, not a raw POST", () => {
    expect(source).toContain("createNotionPageSourceFailSoft");
    expect(source).not.toMatch(/fetch\(`\$\{NOTION_API\}\/pages`/);
  });

  test("the admin email reports a dropped Source instead of a bare 'created'", () => {
    expect(source).toContain("droppedSource");
    expect(source).toContain("created (without Source");
  });
});
