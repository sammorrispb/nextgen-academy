#!/usr/bin/env node
// Offline review only. No provider call, credentials, database connection or apply.
// The fixed main-only release runner validates the same private manifest again.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const keys=['mvf-junior-tournament-10u-2026-10-24','mvf-junior-tournament-14u-2026-10-24'];
const accounts=new Set(['acct_1TU4iSBpXOfTC961','acct_1SOoW57210nhTc4j','acct_1QW4X9QQhXsuDJ9t']);
const digest=/^[a-f0-9]{64}$/;
const isDigest=value=>typeof value==='string' && digest.test(value);
const rootFields=['schemaVersion','pool','seatLimit','providerVerified','reconciledAtUtc','sourceRevision','expectedActiveSeats','expectedReleasedSeats','divisions'];
const invoiceFields=['invoiceId','attendeeKey','requestKey','poolAttendeeKey','state','providerStatus','refundVerified','providerAccountId','legacyCallbackHold','adminNotified','parentNotified'];
function shape(value, fields) {
  return value!==null && typeof value==='object' && !Array.isArray(value)
    && Object.keys(value).length===fields.length && fields.every(k=>Object.hasOwn(value,k));
}
export function prepare(value) {
  if (!shape(value,rootFields) || value.schemaVersion!==1 || value.pool!=='mvf-2026-10-24-14u'
      || value.seatLimit!==12 || value.providerVerified!==true || !isDigest(value.sourceRevision)
      || value.expectedActiveSeats!==9 || value.expectedReleasedSeats!==2
      || !Array.isArray(value.divisions) || value.divisions.length!==2) throw new Error('Verified complete combined-field reconciliation required');
  const iso=value.reconciledAtUtc;
  if(typeof iso!=='string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(iso)
      || !Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString()!==iso.replace(/Z$/,iso.includes('.')?'Z':'.000Z')) throw new Error('Valid UTC reconciliation timestamp required');
  const seen=new Set(); const events=new Set(); const activeAttendees=new Set(); const statements=[];
  let active=0; let released=0;
  for(const division of value.divisions) {
    if(!shape(division,['eventKey','invoices']) || !keys.includes(division.eventKey) || events.has(division.eventKey) || !Array.isArray(division.invoices) || division.invoices.length>24) throw new Error('Invalid or duplicate division');
    events.add(division.eventKey);
    for(const invoice of division.invoices) {
      if(!shape(invoice,invoiceFields) || !isDigest(invoice.requestKey) || !isDigest(invoice.attendeeKey) || !isDigest(invoice.poolAttendeeKey) || typeof invoice.invoiceId!=='string' || !/^in_[A-Za-z0-9]{1,250}$/.test(invoice.invoiceId) || seen.has(invoice.invoiceId) || !['paid','payable','released'].includes(invoice.state) || !accounts.has(invoice.providerAccountId)) throw new Error('Invalid or duplicate opaque invoice');
      if(division.eventKey===keys[1] && invoice.attendeeKey!==invoice.poolAttendeeKey) throw new Error('14U identity must equal the canonical pool identity');
      if(invoice.legacyCallbackHold!==true) throw new Error('Historical callbacks must remain quarantined');
      if(typeof invoice.adminNotified!=='boolean' || typeof invoice.parentNotified!=='boolean') throw new Error('Explicit reviewed notification states required');
      if(typeof invoice.refundVerified!=='boolean'
          || (invoice.state==='paid' && (invoice.providerStatus!=='paid' || invoice.refundVerified))
          || (invoice.state==='payable' && (!['open','uncollectible'].includes(invoice.providerStatus) || invoice.refundVerified))
          || (invoice.state==='released' && !((invoice.providerStatus==='void' && !invoice.refundVerified) || (invoice.providerStatus==='paid' && invoice.refundVerified)))) throw new Error('Provider-confirmed state or full-refund evidence required');
      if(invoice.state!=='released') {
        if(activeAttendees.has(invoice.poolAttendeeKey)) throw new Error('Multiple active invoices for one attendee; reconcile before enabling');
        activeAttendees.add(invoice.poolAttendeeKey); active++;
      } else {
        released++;
      }
      seen.add(invoice.invoiceId);
      const h=createHash('sha256').update(invoice.invoiceId).digest('hex');
      const uuid=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
      const state=invoice.state==='released'?'void':invoice.state;
      statements.push(`insert into ld.nga_tournament_reservations(event_key,submission_id,attendee_key,request_key,pool_attendee_key,invoice_id,state,admin_notified,parent_notified,legacy_callback_hold) values('${division.eventKey}','${uuid}','${invoice.attendeeKey}','${invoice.requestKey}','${invoice.poolAttendeeKey}','${invoice.invoiceId}','${state}',${invoice.adminNotified},${invoice.parentNotified},true);`);
    }
  }
  if(active>12) throw new Error('Combined field exceeds twelve seats');
  if(active!==value.expectedActiveSeats || released!==value.expectedReleasedSeats) throw new Error('Reconciliation must contain expected 9 active and 2 released');
  return [
    '-- REVIEW ONLY. No network or database action was performed by this tool.',
    '-- Apply only through the separately approved main-only capacity activation workflow.',
    '-- Reviewed combined field: expected 9 active and 2 released. Historical callbacks stay held.',
    'begin;',
    'lock table ld.nga_tournament_capacity, ld.nga_tournament_reservations in exclusive mode;',
    "do $$ begin if exists(select 1 from ld.nga_tournament_capacity where ready) or exists(select 1 from ld.nga_tournament_reservations) then raise exception 'Bootstrap requires dark, empty ledger; reconcile instead of overwriting'; end if; end $$;",
    "do $$ begin if (select count(*) from ld.nga_tournament_capacity where event_key in ('"+keys.join("','")+"') and seat_limit=12 and not ready)<>2 then raise exception 'Expected unchanged two-division capacity'; end if; end $$;",
    ...statements,
    "update ld.nga_tournament_capacity set ready=false where event_key='"+keys[0]+"';",
    "update ld.nga_tournament_capacity set ready=true where event_key='"+keys[1]+"';",
    'commit;',
  ].join('\n');
}
try {
  if(!process.argv[2]) throw new Error('Usage: node scripts/prepare-mvf-capacity-bootstrap.mjs reviewed-invoice-manifest.json');
  const text=readFileSync(process.argv[2],'utf8');
  if(Buffer.byteLength(text)>65536) throw new Error('Manifest exceeds review limit');
  process.stdout.write(prepare(JSON.parse(text))+'\n');
} catch(error) { console.error(error instanceof SyntaxError?'Invalid manifest JSON':error.message); process.exitCode=1; }
