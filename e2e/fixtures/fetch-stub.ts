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

interface Rule {
  test: (url: string) => boolean;
  status: number;
  json: unknown;
}

export class FetchStub {
  readonly calls: RecordedFetch[] = [];
  private rules: Rule[] = [];
  private original: typeof globalThis.fetch | null = null;

  on(pattern: string | RegExp, json: unknown, status = 200): this {
    const test =
      typeof pattern === "string"
        ? (u: string) => u.includes(pattern)
        : (u: string) => pattern.test(u);
    this.rules.push({ test, status, json });
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
      this.calls.push({ url, method, body });

      const rule = this.rules.find((r) => r.test(url));
      if (!rule) {
        throw new Error(
          `[fetch-stub] unstubbed fetch — a test dependency reached for the network: ${method} ${url}`,
        );
      }
      return new Response(JSON.stringify(rule.json), {
        status: rule.status,
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
