import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { submissionKeyFor } from "../src/lib/submission-key";
import { clearMvfDraft, emptyMvfForm, focusMvfError, MVF_DRAFT_KEY, MVF_DRAFT_TTL_MS, readMvfDraft, rememberMvfSubmission, saveMvfDraft, type DraftStorage } from "../src/lib/mvf-registration-recovery";

const NOW = 1_800_000_000_000;
const fixture = () => ({ ...emptyMvfForm(), division: "10u", parentName: "Synthetic Parent", email: "synthetic@example.com", phone: "3015550100", childFirstName: "Synthetic", childLastName: "Player", childDob: "2017-03-15", emergencyName: "Synthetic Backup", emergencyPhone: "3015550101", allergies: "SYNTHETIC MEDICAL NOTE", smsConsent: true });
const excludedFields = { childDob: "", emergencyName: "", emergencyPhone: "", allergies: "", smsConsent: false };

function expectNoSensitiveDraftFields(raw: string) {
  for (const field of Object.keys(excludedFields)) {
    expect(raw).not.toContain(`"${field}"`);
  }
  for (const value of ["2017-03-15", "Synthetic Backup", "3015550101", "SYNTHETIC MEDICAL NOTE"]) {
    expect(raw).not.toContain(value);
  }
}

function storage(): DraftStorage {
  const items = new Map<string, string>();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => { items.set(key, value); }, removeItem: (key) => { items.delete(key); } };
}

test("refresh restores a short-lived draft without DOB, emergency contact, medical notes or SMS consent", () => {
  const store = storage();
  saveMvfDraft(store, fixture(), NOW);
  const restored = readMvfDraft(store, NOW + 1);
  expect(restored?.form).toEqual({ ...fixture(), ...excludedFields });
  const raw = store.getItem(MVF_DRAFT_KEY)!;
  expectNoSensitiveDraftFields(raw);
  expect(readMvfDraft(store, NOW + MVF_DRAFT_TTL_MS)).toBeNull();
  expect(store.getItem(MVF_DRAFT_KEY)).toBeNull();
});

test("typing does not extend the original expiry", () => {
  const store = storage();
  expect(saveMvfDraft(store, fixture(), NOW)).toBe(NOW + MVF_DRAFT_TTL_MS);
  expect(saveMvfDraft(store, { ...fixture(), parentName: "Edited Parent" }, NOW + 1000)).toBe(NOW + MVF_DRAFT_TTL_MS);
});

test("an unchanged attempt survives refresh, including retyped excluded fields and an undone edit", async () => {
  const store = storage();
  const firstPage = new Map<string, string>();
  saveMvfDraft(store, fixture(), NOW);
  expect(await rememberMvfSubmission(firstPage, fixture(), store, undefined, NOW)).toBe(true);
  const original = submissionKeyFor(firstPage, fixture());
  const restored = readMvfDraft(store, NOW + 1)!;
  const secondPage = new Map<string, string>();
  expect(await rememberMvfSubmission(secondPage, fixture(), store, restored.lastAttempt, NOW + 1)).toBe(true);
  expect(submissionKeyFor(secondPage, fixture())).toBe(original);
  const edited = { ...fixture(), resident: false };
  await rememberMvfSubmission(secondPage, edited, store, undefined, NOW + 2);
  expect(submissionKeyFor(secondPage, edited)).not.toBe(original);
  const thirdPage = new Map<string, string>();
  await rememberMvfSubmission(thirdPage, fixture(), store, undefined, NOW + 3);
  expect(submissionKeyFor(thirdPage, fixture())).toBe(original);
  const raw = store.getItem(MVF_DRAFT_KEY)!;
  expectNoSensitiveDraftFields(raw);
  expect(raw).not.toContain('\\"email\\"');
});

test("restored uncertain attempt cannot silently invoice changed or omitted sensitive content", async () => {
  const store = storage();
  saveMvfDraft(store, fixture(), NOW);
  await rememberMvfSubmission(new Map(), fixture(), store, undefined, NOW);
  const restored = readMvfDraft(store, NOW + 1)!;
  expect(restored.lastAttempt).toMatch(/^[a-f0-9]{64}$/);
  const nextPage = new Map<string, string>();
  expect(await rememberMvfSubmission(nextPage, restored.form, store, restored.lastAttempt, NOW + 1)).toBe(false);
  expect(nextPage.size).toBe(0);
  expect(await rememberMvfSubmission(nextPage, fixture(), store, restored.lastAttempt, NOW + 2)).toBe(true);
});

test("sensitive fields injected into an older stored draft are dropped on recovery", () => {
  const store = storage();
  saveMvfDraft(store, fixture(), NOW);
  const older = JSON.parse(store.getItem(MVF_DRAFT_KEY)!);
  older.draft = { ...older.draft, childDob: fixture().childDob, emergencyName: fixture().emergencyName, emergencyPhone: fixture().emergencyPhone, allergies: fixture().allergies, smsConsent: true };
  store.setItem(MVF_DRAFT_KEY, JSON.stringify(older));
  expect(readMvfDraft(store, NOW + 1)?.form).toEqual({ ...fixture(), ...excludedFields });
  expectNoSensitiveDraftFields(store.getItem(MVF_DRAFT_KEY)!);
});

test("start-over and acknowledged success remove saved personal fields", async () => {
  const store = storage();
  const issued = new Map<string, string>();
  saveMvfDraft(store, fixture(), NOW);
  await rememberMvfSubmission(issued, fixture(), store, undefined, NOW);
  const original = submissionKeyFor(issued, fixture());
  clearMvfDraft(store, NOW + 1);
  expect(readMvfDraft(store, NOW + 1)).toBeNull();
  expect(store.getItem(MVF_DRAFT_KEY)).not.toContain("synthetic@example.com");
  const nextPage = new Map<string, string>();
  await rememberMvfSubmission(nextPage, fixture(), store, undefined, NOW + 1);
  expect(submissionKeyFor(nextPage, fixture())).toBe(original);
});

test("corrupt, expired, future, foreign-version and wrong-typed drafts are discarded", () => {
  const store = storage();
  saveMvfDraft(store, fixture(), NOW);
  const valid = JSON.parse(store.getItem(MVF_DRAFT_KEY)!);
  for (const value of [null, [], { ...valid, version: 99 }, { ...valid, expiresAt: NOW - 1 }, { ...valid, expiresAt: NOW + MVF_DRAFT_TTL_MS + 1 }, { ...valid, draft: { ...valid.draft, email: {} } }]) {
    store.setItem(MVF_DRAFT_KEY, JSON.stringify(value));
    expect(readMvfDraft(store, NOW)).toBeNull();
  }
  store.setItem(MVF_DRAFT_KEY, "{broken");
  expect(readMvfDraft(store, NOW)).toBeNull();
});

test("blocked session storage preserves the in-page retry without throwing", async () => {
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  const issued = new Map<string, string>();
  expect(readMvfDraft(blocked, NOW)).toBeNull();
  saveMvfDraft(blocked, fixture(), NOW);
  expect(await rememberMvfSubmission(issued, fixture(), blocked, undefined, NOW)).toBe(true);
  const first = submissionKeyFor(issued, fixture());
  await rememberMvfSubmission(issued, fixture(), blocked, undefined, NOW);
  expect(submissionKeyFor(issued, fixture())).toBe(first);
  clearMvfDraft(blocked);
});

test("each validation key maps to a form input ID, including division radio", () => {
  const source = readFileSync(join(__dirname, "../src/components/MvfJuniorTournamentForm.tsx"), "utf8");
  const controls = [...source.matchAll(/<input\b([\s\S]*?)\/>/g)].map((m) => m[1]);
  const focusable = new Set(controls.flatMap((control) => {
    const id = control.match(/\bid="([^"]+)"/)?.[1];
    if (id) return [id];
    if (control.includes('id={`mt-division-${option.division}`}')) return ["mt-division-10u", "mt-division-14u"];
    if (control.includes('id={`mt-resident-${option.value ? "yes" : "no"}`}')) return ["mt-resident-yes", "mt-resident-no"];
    return [];
  }));
  expect(source).toContain("focusMvfError(allErrors, document)");
  expect(source).toContain("focusMvfError(data.errors, document)");
  expect(source).toContain("await rememberMvfSubmission(submissionKeys.current, form, storage.current, recoveryFingerprint.current)");
  expect(source).toContain("readMvfDraft(storage.current)");
  expect(source).toContain("saveMvfDraft(storage.current, form)");
  expect(source).toContain("Please re-enter your player’s date of birth, emergency contact name and phone");
  for (const field of Object.keys(fixture())) {
    let focused = "";
    focusMvfError({ [field]: "Invalid synthetic field" }, { getElementById(id) { return focusable.has(id) ? { focus() { focused = id; } } : null; } });
    expect(focused, `${field} resolves to an actual input`).toBeTruthy();
  }
});
