import { test, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const attendeeKey = "a".repeat(64);
const invoice = (invoiceId: string, state: "void" | "paid" | "payable") => ({
  invoiceId, state, attendeeKey, requestKey: "b".repeat(64), adminNotified: false, parentNotified: false,
});
function prepare(invoices: ReturnType<typeof invoice>[]) {
  const dir = mkdtempSync(join(tmpdir(), "nga-bootstrap-"));
  try {
    const file = join(dir, "reviewed-synthetic.json");
    writeFileSync(file, JSON.stringify({providerVerified:true,reconciledAtUtc:"2026-10-18T00:00:00Z",divisions:[
      {eventKey:"mvf-junior-tournament-10u-2026-10-24",invoices},
      {eventKey:"mvf-junior-tournament-14u-2026-10-24",invoices:[]},
    ]}));
    return spawnSync(process.execPath,["scripts/prepare-mvf-capacity-bootstrap.mjs",file],{encoding:"utf8",env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:"test"}});
  } finally { rmSync(dir,{recursive:true,force:true}); }
}

test("bootstrap retains confirmed void history beside a current payable attendee reservation", () => {
  const result = prepare([invoice("in_QAVoidHistory","void"),invoice("in_QACurrent","payable")]);
  expect(result.status).toBe(0);
  expect(result.stdout.match(/insert into ld\.nga_tournament_reservations/g)).toHaveLength(2);
  expect(result.stdout).toContain("'in_QAVoidHistory','void'");
  expect(result.stdout).toContain("'in_QACurrent','payable'");
});

test("bootstrap refuses two active invoices for one attendee before emitting enabling SQL", () => {
  const result = prepare([invoice("in_QAFirstActive","paid"),invoice("in_QASecondActive","payable")]);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Multiple active invoices for one attendee");
});
