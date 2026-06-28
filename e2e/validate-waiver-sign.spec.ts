import { test, expect } from "@playwright/test";
import {
  validateWaiverSignForm,
  type WaiverSignFormData,
} from "../src/lib/validate-waiver-sign";

// Pure-function spec — no dev server needed:
//   npx playwright test e2e/validate-waiver-sign.spec.ts --project=desktop

function valid(over: Partial<WaiverSignFormData> = {}): Partial<WaiverSignFormData> {
  return {
    parentName: "Jordan Parent",
    email: "jordan@example.com",
    phone: "301-555-0142",
    signatureName: "Jordan A. Parent",
    agree: true,
    ...over,
  };
}

test.describe("validateWaiverSignForm", () => {
  test("a fully valid signature has no errors", () => {
    expect(validateWaiverSignForm(valid())).toEqual({});
  });

  test("parent name is required", () => {
    expect(validateWaiverSignForm(valid({ parentName: "  " })).parentName).toBeTruthy();
  });

  test("a valid email is required", () => {
    expect(validateWaiverSignForm(valid({ email: "" })).email).toBeTruthy();
    expect(validateWaiverSignForm(valid({ email: "nope" })).email).toBeTruthy();
  });

  test("the typed signature is required and must be more than one character", () => {
    expect(validateWaiverSignForm(valid({ signatureName: "" })).signatureName).toBeTruthy();
    expect(validateWaiverSignForm(valid({ signatureName: "  " })).signatureName).toBeTruthy();
    expect(validateWaiverSignForm(valid({ signatureName: "J" })).signatureName).toBeTruthy();
  });

  test("agree must be exactly true (the explicit attestation)", () => {
    expect(validateWaiverSignForm(valid({ agree: false })).agree).toBeTruthy();
    // missing entirely
    const noAgree = valid();
    delete noAgree.agree;
    expect(validateWaiverSignForm(noAgree).agree).toBeTruthy();
  });

  test("phone is optional (the gate's fallback key, never required to sign)", () => {
    expect(validateWaiverSignForm(valid({ phone: "" }))).toEqual({});
  });

  test("an empty form flags every required field", () => {
    const e = validateWaiverSignForm({});
    expect(e.parentName).toBeTruthy();
    expect(e.email).toBeTruthy();
    expect(e.signatureName).toBeTruthy();
    expect(e.agree).toBeTruthy();
  });
});
