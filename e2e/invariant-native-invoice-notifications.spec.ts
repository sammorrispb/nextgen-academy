import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import { checkoutEvent, signedHeader, setWebhookTestEnv } from "./fixtures/stripe-sessions";
import { POST } from "../src/app/api/stripe/webhook/route";
import { getStripe } from "../src/lib/stripe";
const ENV=["STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET","NOTION_API_KEY","NOTION_DROPINS_DB_ID","NGA_ADMIN_SECRET","RESEND_API_KEY","NGA_SYNC_SECRET","LINKDINK_BASE_URL","VERCEL_ENV","OPEN_BRAIN_INGEST_URL","LEAD_INGEST_TOKEN"] as const;
const saved=Object.fromEntries(ENV.map(k=>[k,process.env[k]]));
const stub=new FetchStub();
const rows=new Map<string,{state:string,id:string,token:string,hash:string}>();
const now=Math.floor(Date.now()/1000);
let sends:number;
let failProvider:boolean;
let accountCalls:number;
let restore:()=>void;
function request(kind="lesson", edits:Record<string,unknown>={}, eventTime=now,type="invoice.payment_succeeded") {
 const amount=kind==="lesson"?7500:3500;
 const object={id:"in_SyntheticNative",object:"invoice",livemode:true,currency:"usd",status:"paid",amount_paid:amount,amount_due:amount,total:amount,amount_remaining:0,pre_payment_credit_notes_amount:0,post_payment_credit_notes_amount:0,customer_email:"parent@example.com",status_transitions:{paid_at:now},metadata:{kind,lesson_type:"private",lesson_slug:"private-lesson",payment_owner:"nga_site",parent_name:"Synthetic Parent",child_first_name:"Synthetic"},...edits};
 const body=JSON.stringify({...JSON.parse(checkoutEvent(object,type)),created:eventTime});
 return new NextRequest("http://localhost/api/stripe/webhook",{method:"POST",body,headers:{"stripe-signature":signedHeader(body)}});
}
test.beforeEach(()=>{
 for(const k of ENV)delete process.env[k];setWebhookTestEnv();
 process.env.RESEND_API_KEY="re_test_native_claim";process.env.NGA_SYNC_SECRET="synthetic";process.env.LINKDINK_BASE_URL="https://claims.example.invalid";
 const stripe=getStripe();const old=stripe.accounts.retrieve;stripe.accounts.retrieve=(async()=>{accountCalls++;return{id:"acct_1TU4iSBpXOfTC961"};})as unknown as typeof old;restore=()=>{stripe.accounts.retrieve=old;};
 sends=0;failProvider=false;accountCalls=0;rows.clear();stub.reset();
 stub.onDynamic("internal/nga-invoice-deliveries",call=>{
  const c=JSON.parse(call.body);
  if(c.action==="claim"){
   if(Date.parse(c.paid_at)<Date.now()-86400000||Date.parse(c.event_created_at)<Date.now()-86400000)return{status:200,json:{ok:true,state:"suppressed"}};
   const old=rows.get(c.recipient);if(old){if(old.hash!==c.payload_sha256)return{status:200,json:{ok:true,state:"uncertain"}};if(old.state==="accepted")return{status:200,json:{ok:true,state:"accepted"}};}
   const index=c.recipient==="admin"?1:2;const id=`00000000-0000-4000-8000-00000000000${index}`;const token="11111111-1111-4111-8111-111111111111";rows.set(c.recipient,{state:"leased",id,token,hash:c.payload_sha256});return{status:200,json:{ok:true,state:"leased",delivery_id:id,lease_token:token,provider_key:"nga-native-v1-"+id}};
  }
  const row=[...rows.values()].find(r=>r.id===c.delivery_id)!;expect(row.token).toBe(c.lease_token);row.state=c.outcome;return{status:200,json:{ok:true,recorded:true}};
 });
 stub.onDynamic("api.resend.com/emails",()=>{if(failProvider)return{status:503,json:{}};sends++;return{status:200,json:{id:"synthetic-provider-id"}};});stub.install();
});
test.afterEach(()=>{restore();stub.uninstall();});
test.afterAll(()=>{for(const k of ENV){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});
for(const kind of ["lesson","monday-girls-dropin"]){
 test(`${kind} sends each recipient once and paid-event replay is quiet`,async()=>{
  await POST(request(kind)).catch(()=>undefined);expect(sends).toBe(2);expect([...rows.values()].every(r=>r.state==="accepted")).toBe(true);
  const retry=await POST(request(kind));expect(retry.status).toBe(200);expect(await retry.json()).toMatchObject({idempotent:true});expect(sends).toBe(2);
 });
 test(`${kind} historical callbacks never send old confirmation emails`,async()=>{
  const response=await POST(request(kind,{status_transitions:{paid_at:now-90000}},now-90000));expect(response.status).toBe(200);expect(sends).toBe(0);expect(stub.callsTo("resend")).toHaveLength(0);
 });
}
test("a provider failure returns 503 and a later attempt completes recipient claims",async()=>{
 failProvider=true;expect((await POST(request())).status).toBe(503);expect(sends).toBe(0);failProvider=false;
 await POST(request()).catch(()=>undefined);expect(sends).toBe(2);expect(rows.get("parent")?.state).toBe("accepted");
});
test("missing original paid time is review-only",async()=>{
 const response=await POST(request("lesson",{status_transitions:{}}));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({notificationsHeld:true});expect(sends).toBe(0);expect(accountCalls).toBe(0);
});
test("legacy lesson checkout cannot enter an unclaimed email path",async()=>{
 const response=await POST(request("lesson",{id:"cs_SyntheticLegacy",payment_status:"paid",amount_total:8000},now,"checkout.session.completed"));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({notificationsHeld:true});expect(sends).toBe(0);expect(accountCalls).toBe(0);
});

test("test-mode signed callbacks never reach native email, roster or account lookup",async()=>{
 const req=request();const raw=JSON.parse(await req.text());raw.livemode=false;raw.data.object.livemode=false;const body=JSON.stringify(raw);
 const response=await POST(new NextRequest("http://localhost/api/stripe/webhook",{method:"POST",body,headers:{"stripe-signature":signedHeader(body)}}));
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({skipped:"not_live"});expect(sends).toBe(0);expect(accountCalls).toBe(0);expect(stub.calls).toHaveLength(0);
});
for(const edits of [{livemode:false},{currency:"eur"},{status:"open"},{amount_remaining:1},{amount_paid:7400},{amount_due:7000},{total:8000},{amount_paid:0},{pre_payment_credit_notes_amount:100},{post_payment_credit_notes_amount:100}]) {
 test(`unverified native funding is held ${JSON.stringify(edits)}`,async()=>{
  const response=await POST(request("lesson",edits));expect(response.status).toBe(200);expect(sends).toBe(0);expect(accountCalls).toBe(0);expect(stub.calls).toHaveLength(0);
 });
}
