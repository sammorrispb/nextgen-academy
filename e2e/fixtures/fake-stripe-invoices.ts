import type Stripe from "stripe";

// An in-memory model of the slice of Stripe that createAndSendSignupInvoice
// drives — customers, draft invoices, invoice items, finalize, send, retrieve —
// AND of Stripe's idempotency layer, because the retry invariant rests on it
// (docs.stripe.com/api/idempotent_requests, docs.stripe.com/error-low-level):
//   - a repeated Idempotency-Key with the same request returns the stored
//     result, success or error, marked `Idempotent-Replayed: true`;
//   - a repeated key with a DIFFERENT request is rejected;
//   - a request without a key always executes;
//   - keys are capped at 255 characters.
// It also enforces the rule the double-price bug hinges on: invoice items can
// only be added to a DRAFT invoice.
//
// `loseResponseOf` simulates the failure that makes a parent retry: Stripe
// finishes the call, then the response never arrives.
//
// Installed by patching the cached getStripe() client (the SDK rides node
// http, which FetchStub cannot see) — the invariant-lesson-pricing technique.

export type FakeStripeEndpoint =
  | "customers.create"
  | "invoices.create"
  | "invoiceItems.create"
  | "invoices.finalizeInvoice"
  | "invoices.sendInvoice";

export interface FakeInvoice {
  id: string;
  customer: string;
  status: "draft" | "open";
  metadata: Record<string, string>;
  lines: Array<{ amount: number; description: string }>;
  sends: number;
  hosted_invoice_url: string | null;
}

interface FakeCustomer {
  id: string;
  email: string;
  name?: string;
  seq: number;
}

type Options = { idempotencyKey?: string } | undefined;

class FakeStripeError extends Error {
  constructor(
    readonly type: string,
    message: string,
  ) {
    super(message);
    this.name = "FakeStripeError";
  }
}

/** JSON with object keys sorted, so two equal requests compare equal. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Attach the SDK's non-enumerable `lastResponse`, headers lowercased. */
function respond<T extends object>(value: T, replayed: boolean): T {
  Object.defineProperty(value, "lastResponse", {
    enumerable: false,
    value: {
      headers: replayed ? { "idempotent-replayed": "true" } : {},
      requestId: "req_fake",
      statusCode: 200,
    },
  });
  return value;
}

export class FakeStripeInvoicing {
  readonly customers = new Map<string, FakeCustomer>();
  readonly invoices = new Map<string, FakeInvoice>();
  /** Stripe finishes the next call to this endpoint, then the response is lost. */
  loseResponseOf: FakeStripeEndpoint | null = null;
  private readonly stored = new Map<string, { request: string; ok: boolean; value: unknown }>();
  private seq = 0;

  /** Patch the cached client; returns the undo. */
  install(stripe: Stripe): () => void {
    const undo: Array<() => void> = [];
    const patch = (target: object, key: string, fn: unknown) => {
      const obj = target as Record<string, unknown>;
      const had = Object.prototype.hasOwnProperty.call(obj, key);
      const prev = obj[key];
      obj[key] = fn;
      undo.push(() => {
        if (had) obj[key] = prev;
        else delete obj[key];
      });
    };

    patch(stripe.customers, "list", async (params: { email?: string; limit?: number }) => {
      const data = [...this.customers.values()]
        .filter((c) => c.email === params.email)
        .sort((a, b) => b.seq - a.seq)
        .slice(0, params.limit ?? 10)
        .map((c) => ({ id: c.id, object: "customer", email: c.email, name: c.name ?? null }));
      return respond({ object: "list", data, has_more: false }, false);
    });

    patch(stripe.customers, "create", (params: { email: string; name?: string }, opts: Options) =>
      this.post("customers.create", params, opts, () => {
        const customer = { id: `cus_fake_${++this.seq}`, email: params.email, name: params.name, seq: this.seq };
        this.customers.set(customer.id, customer);
        return { id: customer.id, object: "customer", email: customer.email, name: customer.name ?? null };
      }),
    );

    patch(stripe.invoices, "create", (params: { customer: string; metadata?: Record<string, string> }, opts: Options) =>
      this.post("invoices.create", params, opts, () => {
        if (!this.customers.has(params.customer)) {
          throw new FakeStripeError("invalid_request_error", `No such customer: ${params.customer}`);
        }
        const invoice: FakeInvoice = {
          id: `in_fake_${++this.seq}`,
          customer: params.customer,
          status: "draft",
          metadata: { ...(params.metadata ?? {}) },
          lines: [],
          sends: 0,
          hosted_invoice_url: null,
        };
        this.invoices.set(invoice.id, invoice);
        return this.view(invoice);
      }),
    );

    patch(
      stripe.invoiceItems,
      "create",
      (params: { invoice: string; amount: number; description: string }, opts: Options) =>
        this.post("invoiceItems.create", params, opts, () => {
          const invoice = this.invoices.get(params.invoice);
          if (!invoice) throw new FakeStripeError("invalid_request_error", `No such invoice: ${params.invoice}`);
          if (invoice.status !== "draft") {
            throw new FakeStripeError(
              "invalid_request_error",
              "You can only add invoice items to draft invoices.",
            );
          }
          invoice.lines.push({ amount: params.amount, description: params.description });
          return { id: `ii_fake_${++this.seq}`, object: "invoiceitem", invoice: invoice.id, amount: params.amount };
        }),
    );

    patch(stripe.invoices, "finalizeInvoice", (id: string, params?: object, opts?: Options) =>
      this.post("invoices.finalizeInvoice", { id, ...(params ?? {}) }, opts, () => {
        const invoice = this.mustFind(id);
        if (invoice.status !== "draft") {
          throw new FakeStripeError("invalid_request_error", "This invoice is already finalized.");
        }
        invoice.status = "open";
        invoice.hosted_invoice_url = `https://invoice.stripe.test/${invoice.id}`;
        return this.view(invoice);
      }),
    );

    patch(stripe.invoices, "sendInvoice", (id: string, params?: object, opts?: Options) =>
      this.post("invoices.sendInvoice", { id, ...(params ?? {}) }, opts, () => {
        const invoice = this.mustFind(id);
        if (invoice.status === "draft") {
          throw new FakeStripeError("invalid_request_error", "You can't send a draft invoice.");
        }
        invoice.sends += 1;
        return this.view(invoice);
      }),
    );

    patch(stripe.invoices, "retrieve", async (id: string) => respond(this.view(this.mustFind(id)), false));

    return () => {
      for (const u of undo.reverse()) u();
    };
  }

  /** Every invoice on the fake account. */
  all(): FakeInvoice[] {
    return [...this.invoices.values()];
  }

  private mustFind(id: string): FakeInvoice {
    const invoice = this.invoices.get(id);
    if (!invoice) throw new FakeStripeError("invalid_request_error", `No such invoice: ${id}`);
    return invoice;
  }

  private view(invoice: FakeInvoice) {
    return clone({
      id: invoice.id,
      object: "invoice",
      customer: invoice.customer,
      status: invoice.status,
      metadata: invoice.metadata,
      hosted_invoice_url: invoice.hosted_invoice_url,
      lines: { object: "list", data: invoice.lines, total_count: invoice.lines.length },
    });
  }

  private async post<T extends object>(
    endpoint: FakeStripeEndpoint,
    request: unknown,
    opts: Options,
    exec: () => T,
  ): Promise<T> {
    const key = opts?.idempotencyKey;
    if (key !== undefined && key.length > 255) {
      throw new FakeStripeError("invalid_request_error", "Idempotency keys can be at most 255 characters.");
    }
    const fingerprint = `${endpoint} ${stableJson(request)}`;
    if (key !== undefined) {
      const hit = this.stored.get(key);
      if (hit) {
        if (hit.request !== fingerprint) {
          throw new FakeStripeError(
            "idempotency_error",
            "Keys for idempotent requests can only be used with the same parameters they were first used with.",
          );
        }
        if (!hit.ok) throw hit.value;
        return respond(clone(hit.value) as T, true);
      }
    }
    let value: unknown;
    let ok = true;
    try {
      value = exec();
    } catch (err) {
      value = err;
      ok = false;
    }
    if (key !== undefined) this.stored.set(key, { request: fingerprint, ok, value: ok ? clone(value) : value });
    if (!ok) throw value;
    if (this.loseResponseOf === endpoint) {
      this.loseResponseOf = null;
      throw new Error(`socket hang up (fake: ${endpoint} ran on Stripe, the response was lost)`);
    }
    return respond(clone(value) as T, false);
  }
}
