import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import { FakeStripeInvoicing } from "./fixtures/fake-stripe-invoices";
import { getStripe } from "../src/lib/stripe";
import { POST } from "../src/app/api/checkout-mvf-junior-tournament/route";
import { createAndSendSignupInvoice } from "../src/lib/stripe-invoices";
import { reserveMvfSeat } from "../src/lib/mvf-capacity";

const KEYS = ["STRIPE_SECRET_KEY","NOTION_API_KEY","NOTION_MVF_TOURNAMENT_REGS_DB_ID","NOTION_WAIVERS_DB_ID","RESEND_API_KEY","VERCEL_ENV","LINKDINK_BASE_URL","NGA_SYNC_SECRET","OPEN_BRAIN_INGEST_URL","LEAD_INGEST_TOKEN","TWILIO_ACCOUNT_SID","TWILIO_AUTH_TOKEN","TWILIO_FROM_NUMBER"] as const;
const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
const stub = new FetchStub();
let fake: FakeStripeInvoicing;
let restore = () => {};
const originalNow = Date.now;
test.beforeEach(() => {
  // Capacity admission invariants describe the historical open event.
  Date.now = () => Date.parse("2026-10-23T12:00:00Z");
  for (const k of KEYS) delete process.env[k];
  process.env.STRIPE_SECRET_KEY = "sk_test_capacity";
  process.env.NGA_SYNC_SECRET = "local-capacity";
  process.env.LINKDINK_BASE_URL = "https://capacity.example.invalid";
  fake = new FakeStripeInvoicing(); restore = fake.install(getStripe());
  stub.reset(); stub.install();
});
test.afterEach(() => { Date.now = originalNow; restore(); stub.uninstall(); });
test.afterAll(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });
const data = (id: string) => ({ division:"10u",resident:true,parentName:"Synthetic Parent",email:"synthetic@example.invalid",phone:"2025550100",childFirstName:"Synthetic",childLastName:"Fixture",childDob:"2017-03-15",emergencyName:"Synthetic Backup",emergencyPhone:"2025550110",allergies:"",smsConsent:false,submissionId:id });
const req = (id: string) => new NextRequest("http://localhost/api/checkout-mvf-junior-tournament", { method:"POST",body:JSON.stringify(data(id)),headers:{"content-type":"application/json","x-forwarded-for":id} });

test("capacity unavailable fails closed before any invoice write", async () => {
  delete process.env.NGA_SYNC_SECRET;
  const response = await POST(req("11111111-1111-4111-8111-111111111111"));
  expect(response.status).toBe(503); expect(fake.all()).toHaveLength(0); expect(stub.calls).toHaveLength(0);
});
test("one remaining seat accepts only one concurrent checkout", async () => {
  const held = new Set<string>();
  stub.onDynamic("capacity.example.invalid/play/api/internal/nga-tournament-capacity", call => {
    const c = JSON.parse(call.body);
    if (c.action === "reserve") {
      if (!held.has(c.submission_id) && held.size >= 1) return { status:409,json:{error:"capacity_full"} };
      held.add(c.submission_id); return {status:200,json:{ok:true,state:"held",invoice_id:null}};
    }
    return {status:200,json:{ok:true,invoice_id:c.invoice_id}};
  });
  stub.on("capacity.example.invalid",{ok:true});
  const results = await Promise.all([POST(req("22222222-2222-4222-8222-222222222222")), POST(req("33333333-3333-4333-8333-333333333333"))]);
  expect(results.map(r => r.status).sort()).toEqual([200,409]); expect(fake.all()).toHaveLength(1);
});
test("binding failure leaves the invoice an unpayable non-advancing draft", async () => {
  await expect(createAndSendSignupInvoice({ customerEmail:"synthetic@example.invalid",items:[{description:"Synthetic",amountCents:5000}],metadata:{kind:"synthetic"},idempotencyKey:"capacity-failed",beforeFinalize:async () => { throw new Error("unavailable"); } })).rejects.toThrow("unavailable");
  expect(fake.all()).toHaveLength(1); expect(fake.all()[0].status).toBe("draft"); expect(fake.all()[0].auto_advance).toBe(false);
  expect(fake.all()[0].sends).toBe(0);
});
test("capacity transport sends no child/contact fields and never follows redirects", async () => {
  let captured: RequestInit | undefined;
  const previous = globalThis.fetch;
  globalThis.fetch = async (_url, init) => { captured = init; return Response.json({ok:true,state:"held",invoice_id:null}); };
  try { await reserveMvfSeat("10u","44444444-4444-4444-8444-444444444444","a".repeat(64),"b".repeat(64)); } finally { globalThis.fetch = previous; }
  expect(captured?.redirect).toBe("error");
  expect(Object.keys(JSON.parse(String(captured?.body))).sort()).toEqual(["action","attendee_key","event_key","request_key","submission_id"]);
});

test("a different submission for an existing attendee is refused without invoice disclosure", async () => {
  stub.on("capacity.example.invalid",{error:"registration_exists"},409);
  const response=await POST(req("55555555-5555-4555-8555-555555555555"));
  expect(response.status).toBe(409);
  const body=await response.json();
  expect(body.code).toBe("registration_exists");
  expect(body.invoiceId).toBeUndefined(); expect(body.url).toBeUndefined(); expect(fake.all()).toHaveLength(0);
});

test("the same submission cannot change residency, contact or emergency details", async () => {
  const attempts=new Map<string,{request:string;invoice:string|null}>();
  stub.onDynamic("capacity.example.invalid/play/api/internal/nga-tournament-capacity",call=>{
    const c=JSON.parse(call.body);
    if(c.action==="bind") { attempts.get(c.submission_id)!.invoice=c.invoice_id; return {status:200,json:{ok:true,invoice_id:c.invoice_id}}; }
    const existing=attempts.get(c.submission_id);
    if(existing && existing.request!==c.request_key) return {status:409,json:{error:"reservation_conflict"}};
    const value=existing || {request:c.request_key,invoice:null}; attempts.set(c.submission_id,value);
    return {status:200,json:{ok:true,state:value.invoice?"payable":"held",invoice_id:value.invoice}};
  });
  stub.on("capacity.example.invalid",{ok:true});
  const id="66666666-6666-4666-8666-666666666666";
  expect((await POST(req(id))).status).toBe(200);
  const before=JSON.stringify(fake.all());
  for(const change of [{resident:false},{phone:"2025550199"},{emergencyName:"Changed"},{allergies:"Changed"}]) {
    const response=await POST(new NextRequest("http://localhost/api/checkout-mvf-junior-tournament",{method:"POST",body:JSON.stringify({...data(id),...change}),headers:{"content-type":"application/json","x-forwarded-for":"192.0.2.61"}}));
    expect(response.status).toBe(409); const body=await response.json(); expect(body.code).toBe("registration_changed"); expect(body.invoiceId).toBeUndefined(); expect(body.url).toBeUndefined();
    expect(JSON.stringify(fake.all())).toBe(before);
  }
});
