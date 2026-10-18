#!/usr/bin/env node
// Offline review tool only: never connects to Stripe/P3/Notion or applies SQL.
// Run only after an operator independently reconciles ALL paid, still-payable,
// and provider-confirmed-void invoices. Freeze signup during that reconciliation.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const keys=['mvf-junior-tournament-10u-2026-10-24','mvf-junior-tournament-14u-2026-10-24'];
function prepare(value) {
  if (!value || value.providerVerified !== true || !/^\d{4}-\d\d-\d\dT/.test(value.reconciledAtUtc || '') || !Array.isArray(value.divisions) || value.divisions.length!==2) throw new Error('Verified complete two-division reconciliation required');
  const seen=new Set(); const events=new Set(); const statements=[];
  for(const division of value.divisions) {
    if(!keys.includes(division.eventKey) || events.has(division.eventKey) || !Array.isArray(division.invoices)) throw new Error('Invalid or duplicate division');
    events.add(division.eventKey);
    if(division.invoices.filter(i=>i.state!=='void').length>12) throw new Error('More than twelve paid/payable invoices; resolve before enabling');
    const activeAttendees=new Set();
    for(const invoice of division.invoices) {
      if(!/^[a-f0-9]{64}$/.test(invoice.requestKey || '') || !/^[a-f0-9]{64}$/.test(invoice.attendeeKey || '') || !/^in_[A-Za-z0-9]{1,250}$/.test(invoice.invoiceId || '') || seen.has(invoice.invoiceId) || !['paid','payable','void'].includes(invoice.state)) throw new Error('Invalid or duplicate opaque invoice');
      if(typeof invoice.adminNotified!=='boolean' || typeof invoice.parentNotified!=='boolean') throw new Error('Explicit reviewed notification states required');
      if(invoice.state!=='void') {
        if(activeAttendees.has(invoice.attendeeKey)) throw new Error('Multiple active invoices for one attendee; reconcile before enabling');
        activeAttendees.add(invoice.attendeeKey);
      }
      seen.add(invoice.invoiceId);
      const h=createHash('sha256').update(invoice.invoiceId).digest('hex');
      const uuid=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
      statements.push(`insert into ld.nga_tournament_reservations(event_key,submission_id,attendee_key,request_key,invoice_id,state,admin_notified,parent_notified) values('${division.eventKey}','${uuid}','${invoice.attendeeKey}','${invoice.requestKey}','${invoice.invoiceId}','${invoice.state}',${invoice.adminNotified},${invoice.parentNotified});`);
    }
  }
  return [
    '-- REVIEW ONLY. No network or database action was performed by this tool.',
    '-- Apply only through the separately approved coordinated rollout after reconciling all Stripe invoices.',
    'begin;',
    'lock table ld.nga_tournament_capacity, ld.nga_tournament_reservations in exclusive mode;',
    "do $$ begin if exists(select 1 from ld.nga_tournament_capacity where ready) or exists(select 1 from ld.nga_tournament_reservations) then raise exception 'Bootstrap requires dark, empty ledger; reconcile instead of overwriting'; end if; end $$;",
    ...statements,
    "update ld.nga_tournament_capacity set ready=true where event_key in ('"+keys.join("','")+"');",
    'commit;',
  ].join('\n');
}
try {
  if(!process.argv[2]) throw new Error('Usage: node scripts/prepare-mvf-capacity-bootstrap.mjs reviewed-invoice-manifest.json');
  process.stdout.write(prepare(JSON.parse(readFileSync(process.argv[2],'utf8')))+'\n');
} catch(error) { console.error(error.message); process.exitCode=1; }
