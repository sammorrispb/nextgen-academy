import { test, expect } from "@playwright/test";
import {
  suggestEmailCorrection,
  normalizeEmailTypos,
  hadEmailTypo,
} from "../src/lib/email-typo";

test.describe("suggestEmailCorrection", () => {
  test("fixes the gmail.fom typo from the Oct 1 bounce", () => {
    expect(suggestEmailCorrection("harrington.ea@gmail.fom")).toBe(
      "harrington.ea@gmail.com",
    );
  });

  test("fixes common transpositions and TLD typos", () => {
    expect(suggestEmailCorrection("mom@gmial.com")).toBe("mom@gmail.com");
    expect(suggestEmailCorrection("mom@gamil.com")).toBe("mom@gmail.com");
    expect(suggestEmailCorrection("mom@gmail.con")).toBe("mom@gmail.com");
    expect(suggestEmailCorrection("mom@yahooo.com")).toBe("mom@yahoo.com");
    expect(suggestEmailCorrection("mom@hotmal.com")).toBe("mom@hotmail.com");
    expect(suggestEmailCorrection("mom@outlok.com")).toBe("mom@outlook.com");
    expect(suggestEmailCorrection("mom@iclod.com")).toBe("mom@icloud.com");
  });

  test("never alters the local part", () => {
    expect(suggestEmailCorrection("First.Last+tag@gmial.com")).toBe(
      "First.Last+tag@gmail.com",
    );
  });

  test("handles case and surrounding whitespace", () => {
    expect(suggestEmailCorrection("  mom@GMAIL.FOM  ")).toBe("mom@gmail.com");
  });

  test("returns null for correct addresses", () => {
    expect(suggestEmailCorrection("mom@gmail.com")).toBeNull();
    expect(suggestEmailCorrection("mom@yahoo.com")).toBeNull();
  });

  test("returns null for legitimate lookalike domains (no fuzzy matching)", () => {
    // mail.com is one insertion from gmail.com but is a real provider —
    // curated map only, never edit-distance.
    expect(suggestEmailCorrection("mom@mail.com")).toBeNull();
    expect(suggestEmailCorrection("mom@proton.me")).toBeNull();
    expect(suggestEmailCorrection("mom@school.edu")).toBeNull();
  });

  test("returns null for malformed input", () => {
    expect(suggestEmailCorrection("not-an-email")).toBeNull();
    expect(suggestEmailCorrection("mom@")).toBeNull();
    expect(suggestEmailCorrection("@gmail.fom")).toBeNull();
    expect(suggestEmailCorrection("")).toBeNull();
  });
});

test.describe("normalizeEmailTypos", () => {
  test("corrects typos and trims", () => {
    expect(normalizeEmailTypos("mom@gmail.fom")).toBe("mom@gmail.com");
    expect(normalizeEmailTypos("  mom@gmail.com  ")).toBe("mom@gmail.com");
  });

  test("is idempotent", () => {
    const once = normalizeEmailTypos("mom@gmial.com");
    expect(normalizeEmailTypos(once)).toBe(once);
  });
});

test.describe("hadEmailTypo", () => {
  test("detects typos", () => {
    expect(hadEmailTypo("mom@gmail.fom")).toBe(true);
    expect(hadEmailTypo("mom@gmail.com")).toBe(false);
  });
});
