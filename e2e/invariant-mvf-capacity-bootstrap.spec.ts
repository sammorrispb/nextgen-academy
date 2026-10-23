import { test, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const key10 = "mvf-junior-tournament-10u-2026-10-24";
const key14 = "mvf-junior-tournament-14u-2026-10-24";
const hash = (n: number) => n.toString(16).padStart(64, "0");
function invoice(n: number, released = false) {
  return { invoiceId: `in_QASynthetic${n}`, attendeeKey: hash(n), requestKey: hash(n + 100),
    poolAttendeeKey: hash(n), state: released ? "released" : "paid",
    providerStatus: "paid", refundVerified: released,
    providerAccountId: "acct_1SOoW57210nhTc4j", legacyCallbackHold: true,
    adminNotified: false, parentNotified: false };
}
function manifest() {
  return { schemaVersion: 1, pool: "mvf-2026-10-24-14u", seatLimit: 12,
    providerVerified: true, reconciledAtUtc: "2026-10-23T14:00:00Z", sourceRevision: hash(999),
    expectedActiveSeats: 9, expectedReleasedSeats: 2, divisions: [
      { eventKey: key10, invoices: [invoice(1), invoice(2)] },
      { eventKey: key14, invoices: Array.from({ length: 9 }, (_, i) => invoice(i + 3, i >= 7)) },
    ] };
}
function prepare(value: unknown) {
  const dir = mkdtempSync(join(tmpdir(), "nga-bootstrap-"));
  try {
    const file = join(dir, "reviewed-synthetic.json");
    writeFileSync(file, JSON.stringify(value), { mode: 0o600 });
    return spawnSync(process.execPath, ["scripts/prepare-mvf-capacity-bootstrap.mjs", file], {
      encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", TZ: "UTC" },
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test("combined bootstrap counts nine active seats and retains two released histories", () => {
  const result = prepare(manifest());
  expect(result.status).toBe(0);
  expect(result.stdout.match(/insert into ld\.nga_tournament_reservations/g)).toHaveLength(11);
  expect(result.stdout).toContain("pool_attendee_key");
  expect(result.stdout).toContain("legacy_callback_hold");
  expect(result.stdout).toContain("'in_QASynthetic10','void'");
  expect(result.stdout).toContain("'in_QASynthetic11','void'");
  expect(result.stdout).toContain(`set ready=true where event_key='${key14}'`);
  expect(result.stdout).toContain(`set ready=false where event_key='${key10}'`);
  expect(result.stdout).not.toContain("set ready=true where event_key in");
  expect(result.stdout).toContain("exclusive mode");
  expect(result.stdout).toContain("expected 9 active and 2 released");
});
test("released history may share a pooled identity with a current paid registration", () => {
  const value = manifest();
  value.divisions[1].invoices[7].poolAttendeeKey = value.divisions[0].invoices[0].poolAttendeeKey;
  value.divisions[1].invoices[7].attendeeKey = value.divisions[0].invoices[0].poolAttendeeKey;
  value.divisions[1].invoices[7].requestKey = value.divisions[0].invoices[0].requestKey;
  expect(prepare(value).status).toBe(0);
});
test("combined pool rejects duplicate active children across original division keys", () => {
  const value = manifest();
  value.divisions[1].invoices[0].poolAttendeeKey = value.divisions[0].invoices[0].poolAttendeeKey;
  value.divisions[1].invoices[0].attendeeKey = value.divisions[0].invoices[0].poolAttendeeKey;
  const result = prepare(value);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Multiple active invoices for one attendee");
});
const invalidCases: [string, (value: ReturnType<typeof manifest>) => void][] = [
  ["missing historical callback hold", v => { v.divisions[0].invoices[0].legacyCallbackHold = false; }],
  ["released without provider full refund or void", v => { v.divisions[1].invoices[7].refundVerified = false; }],
  ["active with provider refund", v => { v.divisions[0].invoices[0].refundVerified = true; }],
  ["paid with open provider status", v => { v.divisions[0].invoices[0].providerStatus = "open"; }],
  ["unknown provider account", v => { v.divisions[0].invoices[0].providerAccountId = "acct_QAOther"; }],
  ["duplicate invoice", v => { v.divisions[1].invoices[0].invoiceId = v.divisions[0].invoices[0].invoiceId; }],
  ["missing source revision", v => { v.sourceRevision = ""; }],
  ["incomplete provider verification", v => { v.providerVerified = false; }],
  ["invalid UTC date", v => { v.reconciledAtUtc = "2026-02-30T12:00:00Z"; }],
  ["wrong target pool", v => { v.pool = "10u"; }],
  ["wrong seat limit", v => { v.seatLimit = 13; }],
  ["incorrect expected counts", v => { v.expectedActiveSeats = 8; }],
  ["missing invoice", v => { v.divisions[0].invoices.pop(); }],
  ["incomplete divisions", v => { v.divisions.pop(); }],
  ["duplicate division", v => { v.divisions[0].eventKey = key14; }],
  ["malformed digest", v => { v.divisions[0].invoices[0].poolAttendeeKey = "no"; }],
  ["array coerced to digest", v => { Object.assign(v.divisions[0].invoices[0], { attendeeKey: [hash(1)] }); }],
  ["array coerced to invoice ID", v => { Object.assign(v.divisions[0].invoices[0], { invoiceId: ["in_QAArray"] }); }],
  ["array coerced to source revision", v => { Object.assign(v, { sourceRevision: [hash(999)] }); }],
  ["mismatched 14U pooled identity", v => { v.divisions[1].invoices[0].poolAttendeeKey = hash(999); }],
  ["contradictory void and refund evidence", v => { v.divisions[1].invoices[7].providerStatus = "void"; }],
];
for (const [name, mutate] of invalidCases) {
  test(`bootstrap emits no enabling SQL for ${name}`, () => {
    const value = manifest(); mutate(value);
    const result = prepare(value);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });
}
test("bootstrap rejects extra private fields without copying them into a report", () => {
  const result = prepare({ ...manifest(), parentEmail: "synthetic@example.invalid" });
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).not.toContain("synthetic@example.invalid");
});
