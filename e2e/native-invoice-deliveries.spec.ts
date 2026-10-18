import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";
import { deliverNativeInvoiceEmail, verifiedNativeInvoiceContext } from "../src/lib/native-invoice-deliveries";
const ENV = ["NGA_SYNC_SECRET", "LINKDINK_BASE_URL", "VERCEL_ENV", "RESEND_API_KEY"] as const;
const saved = Object.fromEntries(ENV.map(k => [k, process.env[k]]));
const stub = new FetchStub();
const id = "11111111-1111-4111-8111-111111111111";
const token = "22222222-2222-4222-8222-222222222222";
const context = { accountId: "acct_1TU4iSBpXOfTC961", invoiceId: "in_Synthetic", kind: "lesson" as const, paidAt: new Date().toISOString(), eventCreatedAt: new Date().toISOString() };
function fundedInvoice() { return { id:"in_Synthetic",livemode:true,status:"paid",currency:"usd",amount_paid:7500,amount_due:7500,total:7500,amount_remaining:0,pre_payment_credit_notes_amount:0,post_payment_credit_notes_amount:0,metadata:{kind:"lesson",lesson_type:"private",lesson_slug:"private-lesson"},status_transitions:{paid_at:Math.floor(Date.now()/1000)} }; }
const payload = { from: "NGA <noreply@nextgenpbacademy.com>", to: "parent@example.com", replyTo: "admin@example.com", subject: "Synthetic confirmation", text: "Synthetic text" };
let state: string;
let leaseToken: string;
let hashes: string[];
let providerKeys: string[];
let accepted: number;
let loseFinish: boolean;
let providerError: boolean;
let sentKeys: Set<string>;
function ledger() {
 stub.onDynamic("internal/nga-invoice-deliveries", call => {
  const command = JSON.parse(call.body);
  if (command.action === "claim") {
   hashes.push(command.payload_sha256);
   if (hashes[0] !== command.payload_sha256) return { status: 200, json: { ok: true, state: "uncertain" } };
   if (state === "leased") return { status: 200, json: { ok: true, state: "pending" } };
   if (["accepted", "uncertain", "suppressed"].includes(state)) return { status: 200, json: { ok: true, state } };
   state = "leased"; leaseToken = token;
   return { status: 200, json: { ok: true, state: "leased", delivery_id: id, lease_token: token, provider_key: "nga-native-v1-" + id } };
  }
  expect(command.lease_token).toBe(leaseToken);
  if (loseFinish) { loseFinish = false; return { status: 503, json: {} }; }
  state = command.outcome;
  return { status: 200, json: { ok: true, recorded: true } };
 });
 stub.onDynamic("api.resend.com/emails", call => {
  const wire = JSON.parse(call.body);
  expect(wire.reply_to).toBe(payload.replyTo); expect(wire.replyTo).toBeUndefined();
  if (providerError) return { status: 503, json: { message: "synthetic failure" } };
  const providerKey = providerKeys.at(-1)!;
  if (!sentKeys.has(providerKey)) { sentKeys.add(providerKey); accepted++; }
  return { status: 200, json: { id: "synthetic-provider-id" } };
 });
}
test.beforeEach(() => {
 process.env.NGA_SYNC_SECRET = "synthetic"; process.env.LINKDINK_BASE_URL = "https://internal.example.invalid"; process.env.RESEND_API_KEY = "re_test_synthetic";
 state = "retry"; leaseToken = token; hashes = []; providerKeys = []; accepted = 0; loseFinish = false; providerError = false; sentKeys = new Set();
 stub.reset(); ledger(); stub.install();
 const fetch = globalThis.fetch;
 globalThis.fetch = (input, init) => { if (String(input).includes("api.resend.com")) providerKeys.push(new Headers(init?.headers).get("idempotency-key")!); return fetch(input, init); };
});
test.afterEach(() => stub.uninstall());
test.afterAll(() => { for(const key of ENV) { if(saved[key]===undefined) delete process.env[key]; else process.env[key]=saved[key]; } });

test("success claims the exact provider payload before sending and stores acceptance", async () => {
 const result = await deliverNativeInvoiceEmail(context, "parent", payload);
 expect(result).toEqual({ state: "accepted", fresh: true }); expect(accepted).toBe(1); expect(state).toBe("accepted");
 const calls = stub.calls;
 expect(calls.map(c => c.url.includes("resend") ? "send" : JSON.parse(c.body).action)).toEqual(["claim", "send", "finish"]);
 expect(JSON.stringify(JSON.parse(calls[0].body))).not.toMatch(/parent@example|Synthetic text|Synthetic confirmation/);
 expect(hashes[0]).toMatch(/^[a-f0-9]{64}$/);
 expect(providerKeys).toEqual(["nga-native-v1-" + id]);
});

test("repeat and concurrent deliveries produce one accepted notification", async () => {
 const results = await Promise.allSettled([deliverNativeInvoiceEmail(context,"parent",payload),deliverNativeInvoiceEmail(context,"parent",payload)]);
 expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1); expect(accepted).toBe(1);
 expect(await deliverNativeInvoiceEmail(context,"parent",payload)).toEqual({ state:"accepted",fresh:false }); expect(accepted).toBe(1);
});

test("provider failures are retryable and never acknowledged as accepted", async () => {
 providerError = true; await expect(deliverNativeInvoiceEmail(context,"parent",payload)).rejects.toThrow("pending");
 expect(state).toBe("retry"); expect(accepted).toBe(0);
 providerError = false; expect((await deliverNativeInvoiceEmail(context,"parent",payload)).fresh).toBe(true); expect(hashes[0]).toBe(hashes[1]);
});

test("lost acceptance acknowledgment keeps the original hash on retry", async () => {
 loseFinish = true; await expect(deliverNativeInvoiceEmail(context,"parent",payload)).rejects.toThrow("pending");
 state="retry"; await deliverNativeInvoiceEmail(context,"parent",payload);
 expect(hashes[0]).toBe(hashes[1]); expect(accepted).toBe(1); expect(providerKeys).toHaveLength(2); expect(providerKeys[0]).toBe(providerKeys[1]);
});

test("changed content is held instead of minting another delivery key", async () => {
 await deliverNativeInvoiceEmail(context,"parent",payload);
 expect(await deliverNativeInvoiceEmail(context,"parent",{...payload,text:"Changed text"})).toEqual({state:"uncertain",fresh:false}); expect(accepted).toBe(1); expect(providerKeys).toHaveLength(1);
});

for(const held of ["suppressed","uncertain"]) test(`${held} claims send no email`,async()=>{
 state=held; expect(await deliverNativeInvoiceEmail(context,"parent",payload)).toEqual({state:held,fresh:false}); expect(accepted).toBe(0);
});

test("a ledger outage never falls back to an unclaimed email",async()=>{
 stub.reset(); stub.on("internal/nga-invoice-deliveries",{},503);
 await expect(deliverNativeInvoiceEmail(context,"parent",payload)).rejects.toThrow("pending"); expect(stub.callsTo("resend")).toHaveLength(0);
});

test("absent transport credentials or hostile origins never send",async()=>{
 delete process.env.NGA_SYNC_SECRET; await expect(deliverNativeInvoiceEmail(context,"parent",payload)).rejects.toThrow("pending");
 process.env.NGA_SYNC_SECRET="synthetic";process.env.LINKDINK_BASE_URL="https://user:pass@example.com";
 await expect(deliverNativeInvoiceEmail(context,"parent",payload)).rejects.toThrow("pending");expect(stub.calls).toHaveLength(0);
});

test("actual Stripe account identity must match canonical NGA and the signed source",async()=>{
 const invoice=fundedInvoice();
 const event={livemode:true,created:Math.floor(Date.now()/1000)};
 const stripe={accounts:{retrieve:async()=>({id:context.accountId})}};
 expect((await verifiedNativeInvoiceContext(invoice as never,event as never,stripe as never))?.accountId).toBe(context.accountId);
 await expect(verifiedNativeInvoiceContext(invoice as never,{...event,account:"acct_Other"} as never,stripe as never)).rejects.toThrow("pending");
 await expect(verifiedNativeInvoiceContext(invoice as never,event as never,{accounts:{retrieve:async()=>({id:"acct_Other"})}} as never)).rejects.toThrow("pending");
 expect(stub.calls).toHaveLength(0);
});

test("missing or invalid original payment/event time cannot create a notification context",async()=>{
 const stripe={accounts:{retrieve:async()=>{throw new Error("must not call provider");}}};
 for(const paid_at of [undefined,0,-1,1.5,NaN]) expect(await verifiedNativeInvoiceContext({...fundedInvoice(),status_transitions:{paid_at}} as never,{livemode:true,created:Math.floor(Date.now()/1000)} as never,stripe as never)).toBeNull();
 expect(stub.calls).toHaveLength(0);
});

test("malformed claim and finish responses never authorize unclaimed delivery", async () => {
 for(const reply of [{ok:true,state:"leased"},{ok:true,state:"leased",delivery_id:id,lease_token:token,provider_key:"foreign"},{ok:true,state:"unknown"},{ok:false}]) {
  stub.reset();stub.on("internal/nga-invoice-deliveries",reply);
  await expect(deliverNativeInvoiceEmail(context,"parent",payload)).rejects.toThrow("pending");expect(stub.callsTo("resend")).toHaveLength(0);
 }
});

test("missing email credentials leave a durable retry without external email",async()=>{
 delete process.env.RESEND_API_KEY;
 await expect(deliverNativeInvoiceEmail(context,"parent",payload)).rejects.toThrow("pending");expect(state).toBe("retry");expect(stub.callsTo("resend")).toHaveLength(0);
});

test("malformed provider acceptance never becomes an accepted ledger receipt",async()=>{
 stub.reset();ledger();
 // Register the failure before the general provider rule.
 stub.reset();stub.on("api.resend.com/emails",{});ledger();
 await expect(deliverNativeInvoiceEmail(context,"parent",payload)).rejects.toThrow("pending");expect(state).toBe("retry");
});

test("source account retrieval and unsupported Connect invoices fail closed",async()=>{
 const invoice=fundedInvoice();
 const event={livemode:true,created:Math.floor(Date.now()/1000)};
 await expect(verifiedNativeInvoiceContext(invoice as never,event as never,{accounts:{retrieve:async()=>{throw new Error("synthetic unavailable");}}} as never)).rejects.toThrow("pending");
 await expect(verifiedNativeInvoiceContext({...invoice,on_behalf_of:"acct_Other"} as never,event as never,{} as never)).rejects.toThrow("pending");
 expect(await verifiedNativeInvoiceContext({...invoice,id:"in_bad/id"} as never,event as never,{} as never)).toBeNull();
 expect(await verifiedNativeInvoiceContext(invoice as never,{created:0} as never,{} as never)).toBeNull();
 expect(await verifiedNativeInvoiceContext({...invoice,status_transitions:{paid_at:Number.MAX_SAFE_INTEGER}} as never,event as never,{} as never)).toBeNull();
});
