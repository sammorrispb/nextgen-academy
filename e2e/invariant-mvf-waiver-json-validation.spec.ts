import { test, expect } from "@playwright/test";
import { validateMvfJuniorTournament } from "../src/lib/validate-mvf-junior-tournament";
import { validateWaiverSignForm } from "../src/lib/validate-waiver-sign";

// Malformed JSON must be rejected before a route can trim/slice it or send it
// to a provider. All values are synthetic; these tests need no server/env.
const tournament = {
  division: "10u", resident: true, parentName: "Synthetic Parent",
  email: "synthetic@example.com", phone: "3015550100",
  childFirstName: "Synthetic", childLastName: "Player", childDob: "2017-03-15",
  emergencyName: "Synthetic Backup", emergencyPhone: "3015550101",
  allergies: "", smsConsent: false,
};
const waiver = {
  parentName: "Synthetic Parent", email: "synthetic@example.com",
  phone: "3015550100", signatureName: "Synthetic Parent", agree: true,
};

for (const value of [null, [], 17, true, "text"]) {
  test(`non-object JSON ${JSON.stringify(value)} is rejected by both validators`, () => {
    expect(Object.keys(validateMvfJuniorTournament(value))).not.toHaveLength(0);
    expect(Object.keys(validateWaiverSignForm(value))).not.toHaveLength(0);
  });
}

for (const field of ["division", "parentName", "email", "phone", "childFirstName", "childLastName", "childDob", "emergencyName", "emergencyPhone", "allergies"] as const) {
  for (const value of [null, 17, {}, ["text"]]) {
    test(`tournament rejects non-string ${field}: ${JSON.stringify(value)}`, () => {
      expect(validateMvfJuniorTournament({ ...tournament, [field]: value })[field]).toBeTruthy();
    });
  }
}

for (const field of ["resident", "smsConsent"] as const) {
  test(`tournament rejects non-boolean ${field}`, () => {
    for (const value of [null, 1, "true", [], {}]) {
      expect(validateMvfJuniorTournament({ ...tournament, [field]: value })[field]).toBeTruthy();
    }
  });
}

for (const field of ["parentName", "email", "signatureName", "phone", "utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"] as const) {
  for (const value of [null, 17, {}, ["text"]]) {
    test(`waiver rejects non-string ${field}: ${JSON.stringify(value)}`, () => {
      expect(validateWaiverSignForm({ ...waiver, [field]: value })[field]).toBeTruthy();
    });
  }
}

test("valid and omitted optional fields preserve existing behavior", () => {
  expect(validateMvfJuniorTournament(tournament)).toEqual({});
  const requiredTournament: Partial<typeof tournament> = { ...tournament };
  delete requiredTournament.allergies;
  delete requiredTournament.smsConsent;
  expect(validateMvfJuniorTournament(requiredTournament)).toEqual({});
  expect(validateWaiverSignForm(waiver)).toEqual({});
  expect(validateWaiverSignForm({ ...waiver, phone: undefined })).toEqual({});
  for (const agree of ["true", 1, {}, []]) {
    expect(validateWaiverSignForm({ ...waiver, agree }).agree).toBeTruthy();
  }
});
