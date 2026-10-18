import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "../e2e/fixtures/fetch-stub";
import { signedHeader, TEST_WEBHOOK_SECRET } from "../e2e/fixtures/stripe-sessions";
import { POST as webhook } from "../src/app/api/stripe/webhook/route";
import { POST as waiver } from "../src/app/api/waiver-sign/route";

const KEYS = ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','NOTION_API_KEY','NOTION_MVF_TOURNAMENT_REGS_DB_ID','NOTION_WAIVERS_DB_ID','RESEND_API_KEY','VERCEL_ENV','LINKDINK_BASE_URL','NGA_SYNC_SECRET','OPEN_BRAIN_INGEST_URL','OPEN_BRAIN_INGEST_SECRET','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM_NUMBER'];
const savedEnv = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
const stub = new FetchStub();
test.beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  process.env.STRIPE_SECRET_KEY = 'sk_test_offline_boundaries';
  process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  process.env.NOTION_API_KEY = 'ntn_offline_boundaries';
  process.env.NOTION_MVF_TOURNAMENT_REGS_DB_ID = 'mvf_boundaries';
  process.env.RESEND_API_KEY = 're_test_boundaries';
  process.env.NGA_SYNC_SECRET = "qa-capacity";
  process.env.LINKDINK_BASE_URL = "https://capacity.example.invalid";
  stub.reset(); stub.on("capacity.example.invalid", { ok: true, already_paid: true, admin_notified: true, parent_notified: true, notification_retry_allowed: true, legacy_callback_deferred: false }); stub.install();
});
test.afterEach(() => stub.uninstall());
test.afterAll(() => { for (const k of KEYS) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; } });

const req = (path: string, data: unknown) => new NextRequest('http://localhost' + path, {
  method:'POST', body:JSON.stringify(data), headers:{'content-type':'application/json','x-forwarded-for':'192.0.2.88'},
});
const metadata = {kind:'mvf-junior-tournament', division:'10u', division_label:'10U', event_date:'2026-10-24',
  parent_name:'Synthetic Parent', parent_email:'synthetic@example.com', child_first_name:'Synthetic',child_last_name:'Fixture'};

test('a redelivered already-paid invoice produces no repeated announcements', async () => {
  const invoiceId = 'in_syntheticDuplicate';
  stub.on(/api\.notion\.com\/v1\/databases\/mvf_boundaries\/query/, {results:[{id:'synthetic_row',properties:{Paid:{checkbox:true}}}]});
  stub.on('api.resend.com',{id:'synthetic_mail'});
  const payload = JSON.stringify({id:'evt_synthetic_repeated', object:'event', livemode: true,type:'invoice.payment_succeeded',data:{object:{id:invoiceId,object:'invoice',amount_paid:5000,customer_email:'synthetic@example.com',metadata}}});
  for(let i=0;i<2;i++) {
    const request = new NextRequest('http://localhost/api/stripe/webhook',{method:'POST',body:payload,headers:{'stripe-signature':signedHeader(payload)}});
    // next/server after() throws outside request context; all observed sends precede it.
    const response = await webhook(request);
    expect(response.status).toBe(200);
  }
  expect(stub.callsTo('api.resend.com')).toHaveLength(0);
  expect(stub.calls.filter(c=>c.method==='PATCH')).toHaveLength(0);
});

test('failed waiver storage refuses signing and sends no confirmation',async()=> {
  process.env.NOTION_WAIVERS_DB_ID='waiver_boundaries';
  stub.on(/api\.notion\.com\/v1\/databases\/waiver_boundaries\/query/,{results:[]});
  stub.on(/api\.notion\.com\/v1\/pages$/,{message:'synthetic unavailable'},503);
  stub.on('api.resend.com',{id:'synthetic_mail'});
  const response=await waiver(req('/api/waiver-sign',{parentName:'Synthetic Parent',email:'synthetic@example.com',phone:'3015550199',signatureName:'Synthetic Parent',agree:true}));
  expect(response.status).toBe(503); expect((await response.json()).success).not.toBe(true);
  expect(stub.callsTo('api.resend.com')).toHaveLength(0);
});

test("both paid event aliases retry only the missing notification after a partial mail failure", async () => {
  let parentSent = false;
  let parentAttempts = 0;
  stub.reset();
  stub.onDynamic("capacity.example.invalid", call => {
    const body = JSON.parse(call.body);
    if (body.action === "notified") { if (body.recipient === "parent") parentSent = true; return {status:200,json:{ok:true,recorded:true}}; }
    return {status:200,json:{ok:true,already_paid:true,admin_notified:true,parent_notified:parentSent,notification_retry_allowed:true,legacy_callback_deferred:false}};
  });
  stub.on("api.notion.com",{results:[{id:"synthetic-row",properties:{Paid:{checkbox:true}}}]});
  stub.onDynamic("api.resend.com", () => {
    parentAttempts++;
    return parentAttempts === 1 ? {status:503,json:{name:"application_error",message:"synthetic outage"}} : {status:200,json:{id:"synthetic-email"}};
  });
  for (const [type, status] of [["invoice.payment_succeeded",503],["invoice.paid",200],["invoice.payment_succeeded",200]] as const) {
    const payload=JSON.stringify({id:"evt_synthetic_alias",object:"event", livemode: true,type,data:{object:{id:"in_QAAlias",object:"invoice",amount_paid:5000,customer_email:"synthetic@example.invalid",metadata}}});
    const response=await webhook(new NextRequest("http://localhost/api/stripe/webhook",{method:"POST",body:payload,headers:{"stripe-signature":signedHeader(payload)}}));
    expect(response.status).toBe(status);
  }
  expect(parentAttempts).toBe(2); expect(parentSent).toBe(true);
});

test("concurrent webhook requests use the same provider idempotency key per recipient", async () => {
  stub.reset();
  stub.onDynamic("capacity.example.invalid", call => ({status:200,json:JSON.parse(call.body).action === "notified" ? {ok:true,recorded:true} : {ok:true,already_paid:true,admin_notified:false,parent_notified:false,notification_retry_allowed:true,legacy_callback_deferred:false}}));
  stub.on("api.notion.com",{results:[{id:"synthetic-row",properties:{Paid:{checkbox:true}}}]});
  stub.on("api.resend.com",{id:"synthetic-email"});
  const keys:string[]=[];
  const installed=globalThis.fetch;
  globalThis.fetch=async (input,init) => {
    if(String(input).includes("api.resend.com")) keys.push(new Headers(init?.headers).get("idempotency-key") || "");
    return installed(input,init);
  };
  const payload=JSON.stringify({id:"evt_synthetic_concurrent",object:"event", livemode: true,type:"invoice.payment_succeeded",data:{object:{id:"in_QAConcurrent",object:"invoice",amount_paid:5000,customer_email:"synthetic@example.invalid",metadata}}});
  try {
    const responses=await Promise.all([1,2].map(() => webhook(new NextRequest("http://localhost/api/stripe/webhook",{method:"POST",body:payload,headers:{"stripe-signature":signedHeader(payload)}}))));
    expect(responses.map(r=>r.status)).toEqual([200,200]);
    expect(keys.sort()).toEqual(["mvf-paid-in_QAConcurrent-admin","mvf-paid-in_QAConcurrent-admin","mvf-paid-in_QAConcurrent-parent","mvf-paid-in_QAConcurrent-parent"]);
  } finally { globalThis.fetch=installed; }
});

test("an ambiguous unacknowledged send beyond the provider replay window needs reconciliation", async () => {
  stub.reset();
  stub.on("capacity.example.invalid",{ok:true,already_paid:true,admin_notified:false,parent_notified:false,notification_retry_allowed:false,legacy_callback_deferred:false});
  stub.on("api.notion.com",{results:[{id:"synthetic-row",properties:{Paid:{checkbox:true}}}]});
  const payload=JSON.stringify({id:"evt_synthetic_expired",object:"event", livemode: true,type:"invoice.payment_succeeded",data:{object:{id:"in_QAExpired",object:"invoice",amount_paid:5000,customer_email:"synthetic@example.invalid",metadata}}});
  const response=await webhook(new NextRequest("http://localhost/api/stripe/webhook",{method:"POST",body:payload,headers:{"stripe-signature":signedHeader(payload)}}));
  expect(response.status).toBe(503); expect(stub.callsTo("api.resend.com")).toHaveLength(0);
});

test("transient Notion backfill failure requests redelivery before any mail", async () => {
  stub.reset();
  stub.on("capacity.example.invalid",{ok:true,claimed:true,already_paid:true,admin_notified:false,parent_notified:false,notification_retry_allowed:true,legacy_callback_deferred:false});
  stub.on(/api\.notion\.com\/v1\/databases\//,{results:[]});
  stub.on(/api\.notion\.com\/v1\/pages$/,{message:"synthetic unavailable"},503);
  const payload=JSON.stringify({id:"evt_synthetic_backfill",object:"event", livemode: true,type:"invoice.payment_succeeded",data:{object:{id:"in_QABackfill",object:"invoice",amount_paid:5000,customer_email:"synthetic@example.invalid",metadata}}});
  const response=await webhook(new NextRequest("http://localhost/api/stripe/webhook",{method:"POST",body:payload,headers:{"stripe-signature":signedHeader(payload)}}));
  expect(response.status).toBe(500); expect(stub.callsTo("api.resend.com")).toHaveLength(0);
});

for (const initialRoster of ["missing", "permanent"] as const) {
  test(`a lost notification acknowledgment replays an identical admin payload after ${initialRoster} roster recovery`, async () => {
    stub.reset();
    let attempt = 0;
    let rowExists = false;
    let rowPaid = false;
    let adminAcknowledged = false;
    let parentAcknowledged = false;
    let adminAcknowledgments = 0;
    stub.onDynamic("capacity.example.invalid", call => {
      const body = JSON.parse(call.body);
      if (body.action === "roster_claim") return {status:200,json:{ok:true,claimed:true}};
      if (body.action === "notified") {
        if (body.recipient === "admin") {
          if (++adminAcknowledgments === 1) return {status:503,json:{error:"synthetic lost acknowledgment"}};
          adminAcknowledged = true;
        } else parentAcknowledged = true;
        return {status:200,json:{ok:true,recorded:true}};
      }
      attempt++;
      return {status:200,json:{ok:true,already_paid:true,admin_notified:adminAcknowledged,parent_notified:parentAcknowledged,notification_retry_allowed:true,legacy_callback_deferred:false}};
    });
    stub.onDynamic(/api\.notion\.com\/v1\/databases\//, () => {
      if (attempt === 1 && initialRoster === "permanent") return {status:400,json:{message:"synthetic schema failure"}};
      return {status:200,json:{results: rowExists || attempt > 1 ? [{id:"synthetic-row",properties:{Paid:{checkbox:rowPaid || attempt > 1}}}] : []}};
    });
    stub.onDynamic(/api\.notion\.com\/v1\/pages$/, () => {
      rowExists = true;
      return {status:200,json:{id:"synthetic-row"}};
    });
    stub.onDynamic(/api\.notion\.com\/v1\/pages\/synthetic-row$/, () => {
      rowPaid = true;
      return {status:200,json:{id:"synthetic-row"}};
    });
    const accepted = new Map<string,string>();
    let mismatchedPayloads = 0;
    let deliveries = 0;
    const installed = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      if (!String(input).includes("api.resend.com")) return installed(input,init);
      const key = new Headers(init?.headers).get("idempotency-key") || "";
      const payload = String(init?.body);
      if (accepted.has(key) && accepted.get(key) !== payload) {
        mismatchedPayloads++;
        return Response.json({name:"invalid_idempotent_request",message:"Same key requires identical parameters"},{status:409});
      }
      if (!accepted.has(key)) { accepted.set(key,payload); deliveries++; }
      return Response.json({id:`synthetic-${key}`});
    };
    try {
      const payload=JSON.stringify({id:"evt_synthetic_ack",object:"event", livemode: true,type:"invoice.payment_succeeded",data:{object:{id:`in_QAAck${initialRoster}`,object:"invoice",amount_paid:5000,customer_email:"synthetic@example.invalid",metadata}}});
      const deliver=() => webhook(new NextRequest("http://localhost/api/stripe/webhook",{method:"POST",body:payload,headers:{"stripe-signature":signedHeader(payload)}}));
      expect((await deliver()).status).toBe(503);
      expect((await deliver()).status).toBe(200);
      expect(adminAcknowledged && parentAcknowledged).toBe(true);
      expect(mismatchedPayloads).toBe(0);
      expect(deliveries).toBe(2);
    } finally { globalThis.fetch=installed; }
  });
}
