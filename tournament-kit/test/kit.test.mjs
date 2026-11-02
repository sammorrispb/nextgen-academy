import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { GATES, validate, cloneConfig, publicEvent, zonedInstant } from "../lib/config.mjs";
import { build, verify, pack, hash } from "../lib/build.mjs";
import { createRegistrationClient } from "../lib/registration.mjs";
import { crc32, zip } from "../lib/zip.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = async () => JSON.parse(await fs.readFile(path.join(root, "examples/mvf-november.json"), "utf8"));
const now = Date.parse("2026-11-02T18:00:00Z");
const temp = async t => { const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tournament-kit-test-")); t.after(() => fs.rm(dir, { recursive: true, force: true })); return dir; };
const proofs = () => Object.fromEntries(GATES.map(g => [g, { status: "verified", evidence: "Synthetic offline test receipt for " + g, verifiedAt: "2026-11-01T12:00:00Z" }]));

test("copying a previously open tournament resets every event-specific binding and verification", async () => {
  const old = await fixture(); old.registration.state = "open"; old.readiness = proofs();
  const copy = cloneConfig(old, "new-community-cup");
  assert.equal(old.registration.state, "open"); assert.equal(copy.registration.state, "draft");
  assert.equal(copy.registration.provider, "external"); assert.equal(copy.registration.url, ""); assert.equal(copy.registration.native, undefined);
  assert.equal(copy.startAt, ""); assert.equal(copy.endAt, ""); assert.equal(copy.registration.closesAt, "");
  assert.equal(copy.operations.privateRosterUrl, ""); assert.equal(copy.operations.scoringUrl, ""); assert.equal(copy.operations.director, ""); assert.equal(copy.operations.courts, 0);
  assert.equal(copy.payments.owner, ""); assert.equal(copy.payments.reconciliation, "");
  assert.ok(copy.divisions.every(d => d.eligibility === "")); assert.ok(Object.values(copy.policies).every(v => v === ""));
  assert.ok(Object.values(copy.readiness).every(p => p.status === "pending" && p.evidence === ""));
  assert.ok(validate(copy, now).errors.length > 0);
});

test("a different adult fixed-pair tournament generates a coherent packet without MVF runtime bindings", async t => {
  const dir = await temp(t), c = JSON.parse(await fs.readFile(path.join(root, "examples/adult-fixed.json"), "utf8"));
  c.title = "Synthetic Adults Cup"; c.contact.name = "Synthetic Director";
  c.venue = { name: "Synthetic Indoor Courts", address: "123 Test Lane", indoors: true };
  c.registration.state = "open"; c.registration.url = "https://registration.example.invalid/synthetic-adults";
  c.format.label = "Fixed-partner pool play"; c.format.description = "Enter as a pair; partners stay together.";
  c.format.roundRobin.scoring = "Side-out scoring."; c.format.medals.scoring = "Side-out scoring.";
  c.format.gamesDescription = "Three pool games per pair; qualifying pairs advance to playoffs.";
  c.format.tiebreakers = ["Match wins, then point differential."];
  c.format.medalRules = ["Top two pairs in each pool advance to the semifinals."];
  c.format.turnoutRules = ["The director reviews the confirmed pairs before making pools."];
  c.policies = { refund: "Refund if the organizer cancels.", weather: "Indoors.", minimumEnrollment: "Eight pairs.", waiver: "All players sign the provider waiver." };
  c.payments.owner = "Synthetic Test Organizer"; c.operations.director = "Synthetic Director";
  c.readiness = proofs();
  const result = await build(c, path.join(dir, "pack"), { now });
  assert.equal(result.state, "open");
  const html = await fs.readFile(path.join(result.directory, "public/index.html"), "utf8");
  assert.match(html, /Synthetic Adults Cup/); assert.match(html, /registration\.example\.invalid\/synthetic-adults/); assert.match(html, /Fixed-partner pool play/); assert.match(html, /12 pairs/);
  assert.doesNotMatch(html, /MVF|12U|16U|native-form|guardian name/);
  assert.equal((await verify(result.directory)).ok, true);
  assert.ok((await fs.stat(path.join(result.directory, "public/assets/registration-qr.png"))).size > 100);
  assert.ok((await fs.readFile(path.join(result.directory, "public/assets/registration-qr.svg"), "utf8")).startsWith("<svg"));
  const contract = JSON.parse(await fs.readFile(path.join(result.directory, "public/event.json"), "utf8"));
  assert.equal(contract.registration.nextAction.url, c.registration.url); assert.equal(contract.registration.nextAction.validUntil, c.registration.closesAt);
});

test("public event JSON allowlists fields and never carries internal roster/evidence/financial details", async () => {
  const c = await fixture(); c.operations.privateRosterUrl = "https://notion.example.invalid/INTERNAL_ROSTER";
  c.contact.privateNote = "PRIVATE_CONTACT_NOTE"; c.venue.internalAccess = "PRIVATE_VENUE_NOTE";
  c.divisions[0].privateRoster = ["PRIVATE_PLAYER_NAME"]; c.format.roundRobin.privateNote = "PRIVATE_SCORING_NOTE";
  c.registration.fees[0].privateAllocation = "PRIVATE_ALLOCATION";
  c.readiness.eventDetails.evidence = "PRIVATE_APPROVAL";
  const text = JSON.stringify(publicEvent(c)); assert.doesNotMatch(text, /PRIVATE_|INTERNAL_ROSTER|notion\.com|privateRoster/);
});

test("HTML is escaped and CSV operator values cannot become spreadsheet formulas", async t => {
  const c = await fixture(), dir = await temp(t); c.title = '<img src=x onerror="alert(1)">'; c.operations.director = '=HYPERLINK("https://example.invalid")';
  const result = await build(c, path.join(dir, "packet"), { now });
  const html = await fs.readFile(path.join(result.directory, "public/index.html"), "utf8");
  assert.doesNotMatch(html, /<img src=x/); assert.match(html, /&lt;img src=x/);
  assert.match(await fs.readFile(path.join(result.directory, "private/run-of-show.csv"), "utf8"), /'=HYPERLINK/);
});

test("drafts render closed, and opening requires all dated event-specific evidence", async t => {
  const c = await fixture(), dir = await temp(t);
  assert.equal(validate(c, now).errors.length, 0);
  const result = await build(c, path.join(dir, "draft"), { now });
  const html = await fs.readFile(path.join(result.directory, "public/index.html"), "utf8");
  assert.match(html, /Draft preview/); assert.doesNotMatch(html, /<form|registration-action/);
  await assert.rejects(fs.readFile(path.join(result.directory, "public/native-registration.json")), { code: "ENOENT" });
  c.registration.state = "open"; assert.equal(validate(c, now).errors.filter(e => e.field.startsWith("readiness.")).length, 10);
  c.readiness = proofs(); c.operations.director = "Synthetic Director"; assert.equal(validate(c, now).errors.length, 0);
  c.readiness.payments.verifiedAt = "2099-01-01T00:00:00Z"; assert.ok(validate(c, now).errors.some(e => e.field === "readiness.payments"));
});

test("new native event keys, a different origin, altered server fees and expired deadlines cannot masquerade as installed events", async () => {
  for (const mutate of [
    c => c.registration.native.event = "another-cup",
    c => c.publicUrl = "https://another.example.invalid/cup",
    c => c.registration.fees[0].amountCents = 1,
    c => c.divisions[0].capacity = 100,
  ]) { const c = await fixture(); mutate(c); assert.ok(validate(c, now).errors.length); }
  const c = await fixture(); c.registration.state = "open"; c.readiness = proofs();
  assert.ok(validate(c, Date.parse("2026-11-13T15:00:00Z")).errors.some(e => e.field === "registration.state"));
});

test("dates reject impossible calendar values and incorrect summer/winter timezone offsets", () => {
  assert.equal(zonedInstant("2027-02-31T10:00:00-05:00", "America/New_York"), false);
  assert.equal(zonedInstant("2027-06-01T10:00:00-05:00", "America/New_York"), false);
  assert.equal(zonedInstant("2027-06-01T10:00:00-04:00", "America/New_York"), true);
  assert.equal(zonedInstant("2027-01-01T10:00:00-05:00", "America/New_York"), true);
});

test("unsafe registration URLs and credentials cannot enter a template", async () => {
  for (const url of ["javascript:alert(1)", "http://example.com/", "https://user:pass@example.com/", "https://example.com/?token=secret", "https://example.com/#receipt=private"]) {
    const c = await fixture(); c.registration.url = url; assert.ok(validate(c, now).errors.some(e => e.field === "registration.url"));
  }
  const c = await fixture(); c.secret = "never-store-this"; assert.ok(validate(c, now).errors.some(e => e.field === "config"));
});

test("native retries preserve one submission ID, address and the private receipt boundary", async () => {
  const config = { state: "open", event: "november-2026", revision: "launch-2026-11-02", apiPath: "/api/mvf-series/november-2026/register", closesAt: "2099-01-01T00:00:00Z" };
  const calls = []; let n = 0;
  const register = createRegistrationClient(config, async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) }); if (calls.length === 1) throw new Error("Synthetic lost response");
    return { ok: true, json: async () => ({ receiptUrl: "/mvf-junior-tournament/november-2026/status#receipt=abc.def" }) };
  }, () => `id-${++n}`);
  const fields = { parentName: "Synthetic Guardian", homeAddress: "123 Test Lane\nTest City" };
  await assert.rejects(register(fields)); const receipt = await register(fields);
  assert.equal(calls[0].body.submissionId, calls[1].body.submissionId); assert.equal(calls[1].body.homeAddress, fields.homeAddress);
  assert.match(receipt.receiptUrl, /^\/mvf-junior-tournament/);
  await register({ ...fields, homeAddress: "Different test address" }); assert.notEqual(calls[2].body.submissionId, calls[1].body.submissionId);
  assert.throws(() => createRegistrationClient({ ...config, apiPath: "https://other.example.invalid/collect" }), /Unrecognized/);
  const bad = createRegistrationClient(config, async () => ({ ok: true, json: async () => ({ receiptUrl: "https://evil.example.invalid/" }) }));
  assert.equal((await bad(fields)).code, "verification_required");
  let fetched = false;
  const closed = createRegistrationClient({ ...config, state: "draft" }, async () => { fetched = true; });
  assert.equal((await closed(fields)).code, "registration_closed"); assert.equal(fetched, false);
});

test("verified packages resist overwrites, tampering, unexpected files and archive path traversal", async t => {
  const c = await fixture(), dir = await temp(t), out = path.join(dir, "event"); await build(c, out, { now });
  await assert.rejects(build(c, out, { now }), /already exists/);
  const archive = path.join(dir, "event.zip"), receipt = await pack(out, archive); assert.ok(receipt.entries > 20);
  assert.equal((await fs.readFile(archive)).readUInt32LE(0), 0x04034b50);
  assert.throws(() => zip([["../escape.txt", "bad"]]), /Unsafe/);
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  await fs.appendFile(path.join(out, "public/index.html"), "tampered"); await assert.rejects(verify(out), /Integrity/);
  await fs.writeFile(path.join(out, "surprise.txt"), "extra"); await assert.rejects(verify(out), /inventory/);
});

test("a partial or edited reference snapshot cannot be labelled a complete source package", async t => {
  const c = await fixture(), dir = await temp(t), refs = path.join(dir, "refs"); await fs.mkdir(refs);
  await fs.writeFile(path.join(refs, "file.ts"), "source");
  await fs.writeFile(path.join(refs, "source-manifest.json"), JSON.stringify({ components: [], files: { "file.ts": hash("source") } }));
  await assert.rejects(build(c, path.join(dir, "bundle"), { references: refs, now }), /both pinned/);
});

test("the copied CLI starts a fresh event and returns machine-readable next steps", async t => {
  const dir = await temp(t), out = path.join(dir, "new-event");
  const result = JSON.parse(execFileSync(process.execPath, [path.join(root, "cli.mjs"), "init", "--id", "new-synthetic-cup", "--out", out]).toString());
  assert.equal(result.state, "draft"); assert.equal(result.config, path.join(out, "tournament.json"));
  const c = JSON.parse(await fs.readFile(result.config, "utf8")); assert.equal(c.slug, "new-synthetic-cup"); assert.equal(c.registration.native, undefined);
});
