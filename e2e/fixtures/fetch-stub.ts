/**
 * Deterministic global-fetch stub for pure-node invariant specs.
 *
 * Every network dependency in this codebase except the Twilio SDK rides
 * `globalThis.fetch` (Notion = raw fetch, Resend = fetch-based SDK), so one
 * stub makes a route handler fully offline. Any URL without a matching rule
 * THROWS — an accidental real-network dependency fails loudly instead of
 * hanging or silently passing.
 *
 * Rules are first-match-wins: register specific patterns before catch-alls.
 */

export interface RecordedFetch {
  url: string;
  method: string;
  body: string;
}

/**
 * Static JSON, or a responder function evaluated per request (receives the
 * just-recorded call, AFTER it was pushed to `calls`). Responders let a spec
 * model stateful services — e.g. a Notion page that reflects the properties
 * the route just PATCHed onto it (the claim-then-verify race protocol).
 */
type JsonSource = unknown | ((call: RecordedFetch) => unknown);

/** Per-call responder for onDynamic — decide status/json from the request. */
export type FetchResponder = (call: RecordedFetch) => { status: number; json: unknown };

interface Rule {
  test: (url: string) => boolean;
  respond: FetchResponder;
}

function toTest(pattern: string | RegExp): (url: string) => boolean {
  return typeof pattern === "string"
    ? (u: string) => u.includes(pattern)
    : (u: string) => pattern.test(u);
}

export class FetchStub {
  readonly calls: RecordedFetch[] = [];
  private rules: Rule[] = [];
  private original: typeof globalThis.fetch | null = null;

  on(pattern: string | RegExp, json: JsonSource, status = 200): this {
    this.rules.push({
      test: toTest(pattern),
      respond: (call) => ({
        status,
        json:
          typeof json === "function"
            ? (json as (call: RecordedFetch) => unknown)(call)
            : json,
      }),
    });
    return this;
  }

  /** Like on(), but the response is computed per call (e.g. fail only the
   * requests whose BODY matches something) — for fail-soft/partial-failure
   * specs where every request hits the same URL. */
  onDynamic(pattern: string | RegExp, respond: FetchResponder): this {
    this.rules.push({ test: toTest(pattern), respond });
    return this;
  }

  install(): this {
    if (this.original) return this;
    this.original = globalThis.fetch;
    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      let body = "";
      if (init?.body) {
        body = String(init.body);
      } else if (input instanceof Request) {
        body = await input
          .clone()
          .text()
          .catch(() => "");
      }
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      const recorded: RecordedFetch = { url, method, body };
      this.calls.push(recorded);

      const call = this.calls[this.calls.length - 1];
      const rule = this.rules.find((r) => r.test(url));
      if (!rule) {
        throw new Error(
          `[fetch-stub] unstubbed fetch — a test dependency reached for the network: ${method} ${url}`,
        );
      }
      const { status, json } = rule.respond(call);
      return new Response(JSON.stringify(json), {
        status,
        headers: { "content-type": "application/json" },
      });
    }) as typeof globalThis.fetch;
    return this;
  }

  uninstall(): void {
    if (this.original) {
      globalThis.fetch = this.original;
      this.original = null;
    }
  }

  /** Clears calls AND rules — call in beforeEach; rules leak across tests otherwise. */
  reset(): void {
    this.calls.length = 0;
    this.rules.length = 0;
  }

  callsTo(pattern: string | RegExp): RecordedFetch[] {
    const test =
      typeof pattern === "string"
        ? (u: string) => u.includes(pattern)
        : (u: string) => pattern.test(u);
    return this.calls.filter((c) => test(c.url));
  }
}
