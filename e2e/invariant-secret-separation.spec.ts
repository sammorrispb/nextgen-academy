import { test, expect } from "@playwright/test";

// Secret-separation invariants: each token family signs with its OWN secret
// (dedicated env var) so a leaked/rotated NGA_ADMIN_SECRET no longer forges
// every token in the system — while tokens already in parents' inboxes
// (cancel + commit links are non-expiring) keep verifying via legacy fallback.
process.env.NGA_ADMIN_SECRET = "legacy-admin-secret";

import { secretEquals, signingSecrets } from "../src/lib/secret-compare";
import { signCancelToken, verifyCancelToken } from "../src/lib/cancel-token";
import {
  signSessionCancelToken,
  verifySessionCancelToken,
} from "../src/lib/session-cancel-token";
import { signCommitToken, verifyCommitToken } from "../src/lib/commit-token";
import {
  signReferralToken,
  verifyReferralToken,
} from "../src/lib/referral-token";
import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../src/lib/newsletter-token";

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test.describe("secretEquals (timing-safe gate compare)", () => {
  test("equal secrets match; any difference rejects", () => {
    expect(secretEquals("s3cret", "s3cret")).toBe(true);
    expect(secretEquals("s3cret", "s3creT")).toBe(false);
    expect(secretEquals("s3cret", "s3cret-longer")).toBe(false);
    expect(secretEquals("Bearer abc", "Bearer abc")).toBe(true);
  });

  test("fails closed on missing/empty values — both sides", () => {
    expect(secretEquals(null, "expected")).toBe(false);
    expect(secretEquals(undefined, "expected")).toBe(false);
    expect(secretEquals("", "expected")).toBe(false);
    expect(secretEquals("provided", null)).toBe(false);
    expect(secretEquals("provided", undefined)).toBe(false);
    expect(secretEquals("provided", "")).toBe(false);
    expect(secretEquals("", "")).toBe(false); // empty expected never admits
  });

  test("signingSecrets orders dedicated-first, dedups, and tolerates absences", () => {
    withEnv({ X_TOKEN_SECRET: "ded", NGA_ADMIN_SECRET: "leg" }, () =>
      expect(signingSecrets("X_TOKEN_SECRET")).toEqual(["ded", "leg"]),
    );
    withEnv({ X_TOKEN_SECRET: "same", NGA_ADMIN_SECRET: "same" }, () =>
      expect(signingSecrets("X_TOKEN_SECRET")).toEqual(["same"]),
    );
    withEnv({ X_TOKEN_SECRET: undefined, NGA_ADMIN_SECRET: "leg" }, () =>
      expect(signingSecrets("X_TOKEN_SECRET")).toEqual(["leg"]),
    );
    withEnv({ X_TOKEN_SECRET: undefined, NGA_ADMIN_SECRET: undefined }, () =>
      expect(signingSecrets("X_TOKEN_SECRET")).toEqual([]),
    );
  });
});

const COMMIT_PAYLOAD = {
  parentEmail: "parent@example.com",
  childFirstName: "Testkid",
  crewId: "Green|Tuesday|6:00pm|redland ms",
};

test.describe("cancel-token secret separation", () => {
  test("with CANCEL_TOKEN_SECRET set, new tokens survive NGA_ADMIN_SECRET rotation", () => {
    const token = withEnv({ CANCEL_TOKEN_SECRET: "dedicated-cancel" }, () =>
      signCancelToken("cs_new_era"),
    )!;
    expect(token).toBeTruthy();
    // Admin secret rotates (e.g. after a leak) — parent cancel links must live on.
    const verified = withEnv(
      { CANCEL_TOKEN_SECRET: "dedicated-cancel", NGA_ADMIN_SECRET: "rotated" },
      () => verifyCancelToken(token),
    );
    expect(verified).toBe("cs_new_era");
  });

  test("legacy outstanding tokens still verify after CANCEL_TOKEN_SECRET is introduced", () => {
    // Signed in the legacy era (no dedicated secret) → lives in a parent's inbox.
    const legacyToken = withEnv({ CANCEL_TOKEN_SECRET: undefined }, () =>
      signCancelToken("cs_legacy_link"),
    )!;
    const verified = withEnv({ CANCEL_TOKEN_SECRET: "dedicated-cancel" }, () =>
      verifyCancelToken(legacyToken),
    );
    expect(verified).toBe("cs_legacy_link");
  });

  test("with distinct per-family secrets, cross-family tokens never verify", () => {
    // The separation boundary is KEY separation: each family signs with its
    // own dedicated secret, so neither family's verify accepts the other's
    // tokens. (Payload domain separation only exists one-way — the session:
    // prefix protects session-cancel, but cancel-token payloads are raw ids.)
    const sessionToken = withEnv(
      { SESSION_CANCEL_TOKEN_SECRET: "dedicated-session", NGA_ADMIN_SECRET: undefined },
      () => signSessionCancelToken("notion-row-1"),
    )!;
    const crossVerified = withEnv(
      { CANCEL_TOKEN_SECRET: "dedicated-cancel", NGA_ADMIN_SECRET: undefined },
      () => verifyCancelToken(sessionToken),
    );
    expect(crossVerified).toBeNull();

    // Known same-key edge (legacy era, both families on NGA_ADMIN_SECRET): a
    // session token DOES verify as a cancel token, but decodes to a
    // "session:"-prefixed string that can never match a Stripe checkout id
    // (cs_*) — bounded to a no-op lookup. Pinned so a change is visible.
    const legacyToken = signSessionCancelToken("notion-row-1")!;
    const sameKeyDecode = verifyCancelToken(legacyToken);
    expect(sameKeyDecode).toBe("session:notion-row-1");
    expect(sameKeyDecode!.startsWith("cs_")).toBe(false);
  });
});

test.describe("session-cancel-token secret separation", () => {
  test("with SESSION_CANCEL_TOKEN_SECRET set, new tokens survive NGA_ADMIN_SECRET rotation", () => {
    const token = withEnv(
      { SESSION_CANCEL_TOKEN_SECRET: "dedicated-session" },
      () => signSessionCancelToken("notion-row-7"),
    )!;
    const verified = withEnv(
      {
        SESSION_CANCEL_TOKEN_SECRET: "dedicated-session",
        NGA_ADMIN_SECRET: "rotated",
      },
      () => verifySessionCancelToken(token),
    );
    expect(verified).toBe("notion-row-7");
  });

  test("legacy outstanding tokens still verify after the dedicated secret is introduced", () => {
    const legacyToken = withEnv(
      { SESSION_CANCEL_TOKEN_SECRET: undefined },
      () => signSessionCancelToken("notion-row-legacy"),
    )!;
    const verified = withEnv(
      { SESSION_CANCEL_TOKEN_SECRET: "dedicated-session" },
      () => verifySessionCancelToken(legacyToken),
    );
    expect(verified).toBe("notion-row-legacy");
  });
});

test.describe("referral-token secret separation (dual-verify)", () => {
  test("legacy referral links (in old welcome emails) still verify after REFERRAL_TOKEN_SECRET is set", () => {
    // Sign explicitly in the legacy era — workers are reused across spec
    // files and referral-token.spec.ts sets the dedicated var module-side.
    const legacyToken = withEnv({ REFERRAL_TOKEN_SECRET: undefined }, () =>
      signReferralToken("referrer@example.com"),
    )!;
    const verified = withEnv({ REFERRAL_TOKEN_SECRET: "dedicated-referral" }, () =>
      verifyReferralToken(legacyToken),
    );
    expect(verified).toBe("referrer@example.com");
  });

  test("with REFERRAL_TOKEN_SECRET set, new tokens survive NGA_ADMIN_SECRET rotation", () => {
    const token = withEnv({ REFERRAL_TOKEN_SECRET: "dedicated-referral" }, () =>
      signReferralToken("referrer@example.com"),
    )!;
    const verified = withEnv(
      { REFERRAL_TOKEN_SECRET: "dedicated-referral", NGA_ADMIN_SECRET: "rotated" },
      () => verifyReferralToken(token),
    );
    expect(verified).toBe("referrer@example.com");
  });

  test("unsub token can never replay as a referral (ref: prefix domain separation)", () => {
    // Same email, SAME key on both families — the macInput prefix alone must
    // keep them apart (the worst case for domain separation).
    const sameKey = {
      REFERRAL_TOKEN_SECRET: "shared-era-key",
      NEWSLETTER_UNSUB_SECRET: "shared-era-key",
    };
    const unsubToken = withEnv(sameKey, () =>
      signUnsubscribeToken("parent@example.com"),
    )!;
    const referralToken = withEnv(sameKey, () =>
      signReferralToken("parent@example.com"),
    )!;
    withEnv(sameKey, () => {
      expect(verifyReferralToken(unsubToken)).toBeNull();
      expect(verifyUnsubscribeToken(referralToken)).toBeNull();
    });
  });
});

test.describe("newsletter-unsub-token secret separation (dual-verify)", () => {
  test("unsub links in EVERY past issue still verify after NEWSLETTER_UNSUB_SECRET is set", () => {
    // CAN-SPAM-relevant: a broken historical unsubscribe link is not acceptable.
    const legacyToken = withEnv({ NEWSLETTER_UNSUB_SECRET: undefined }, () =>
      signUnsubscribeToken("parent@example.com"),
    )!;
    const verified = withEnv(
      { NEWSLETTER_UNSUB_SECRET: "dedicated-unsub" },
      () => verifyUnsubscribeToken(legacyToken),
    );
    expect(verified).toBe("parent@example.com");
  });

  test("with NEWSLETTER_UNSUB_SECRET set, new tokens survive NGA_ADMIN_SECRET rotation", () => {
    const token = withEnv({ NEWSLETTER_UNSUB_SECRET: "dedicated-unsub" }, () =>
      signUnsubscribeToken("parent@example.com"),
    )!;
    const verified = withEnv(
      { NEWSLETTER_UNSUB_SECRET: "dedicated-unsub", NGA_ADMIN_SECRET: "rotated" },
      () => verifyUnsubscribeToken(token),
    );
    expect(verified).toBe("parent@example.com");
  });
});

test.describe("commit-token secret separation (dual-verify gap)", () => {
  test("legacy outstanding commit links still verify after COMMIT_TOKEN_SECRET is set", () => {
    // commit-token already SIGNS with a dedicated secret when set — but
    // without dual-verify, flipping the env var bricks every commit link
    // already sitting in a parent inbox (they're non-expiring by design).
    const legacyToken = withEnv({ COMMIT_TOKEN_SECRET: undefined }, () =>
      signCommitToken(COMMIT_PAYLOAD),
    )!;
    const verified = withEnv({ COMMIT_TOKEN_SECRET: "dedicated-commit" }, () =>
      verifyCommitToken(legacyToken),
    );
    expect(verified).toEqual(COMMIT_PAYLOAD);
  });

  test("with COMMIT_TOKEN_SECRET set, new tokens survive NGA_ADMIN_SECRET rotation", () => {
    const token = withEnv({ COMMIT_TOKEN_SECRET: "dedicated-commit" }, () =>
      signCommitToken(COMMIT_PAYLOAD),
    )!;
    const verified = withEnv(
      { COMMIT_TOKEN_SECRET: "dedicated-commit", NGA_ADMIN_SECRET: "rotated" },
      () => verifyCommitToken(token),
    );
    expect(verified).toEqual(COMMIT_PAYLOAD);
  });
});
