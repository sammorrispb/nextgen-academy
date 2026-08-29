import { test, expect } from "@playwright/test";

// Env BEFORE imports — all secret reads are lazy/at-call, but keep the spec's
// world explicit.
process.env.FALL_POLL_SECRET = "fall-poll-spec-secret";
process.env.NGA_ADMIN_SECRET = "fall-poll-legacy-secret";

import {
  FALL_POLL_ACTIONS,
  signFallPollToken,
  verifyFallPollToken,
} from "../src/lib/fall-poll-token";
import {
  fallPollInviteHtml,
  fallPollInviteSubject,
  fallPollInviteText,
} from "../src/lib/email/fall-poll-invite";
import { WHATSAPP_PARENT_GROUP_URL } from "../src/lib/email/whatsapp-invite";
import { FALL_POLL_VENUE } from "../src/data/fall-poll-2026";

const EMAIL = "Parent@Example.org";

const LINKS = {
  inUrl: "https://nextgenpbacademy.com/api/fall-poll?action=in&token=t1",
  interestedUrl:
    "https://nextgenpbacademy.com/api/fall-poll?action=interested&token=t2",
  outUrl: "https://nextgenpbacademy.com/api/fall-poll?action=out&token=t3",
};

test.describe("fall-poll token — action binding", () => {
  test("round-trips each action and normalizes the email", () => {
    for (const action of FALL_POLL_ACTIONS) {
      const token = signFallPollToken(EMAIL, action);
      expect(token).toBeTruthy();
      expect(verifyFallPollToken(token!, action)).toBe("parent@example.org");
    }
  });

  test("a token minted for one answer never verifies as another", () => {
    for (const minted of FALL_POLL_ACTIONS) {
      const token = signFallPollToken(EMAIL, minted)!;
      for (const expected of FALL_POLL_ACTIONS) {
        if (expected === minted) continue;
        expect(verifyFallPollToken(token, expected)).toBeNull();
      }
    }
  });

  test("a tampered token fails closed", () => {
    const token = signFallPollToken(EMAIL, "in")!;
    expect(verifyFallPollToken(token.slice(0, -2) + "xx", "in")).toBeNull();
    expect(verifyFallPollToken("not-a-token", "in")).toBeNull();
    expect(verifyFallPollToken("", "in")).toBeNull();
  });

  test("no signing secret at all → sign and verify both fail closed", () => {
    const dedicated = process.env.FALL_POLL_SECRET;
    const legacy = process.env.NGA_ADMIN_SECRET;
    const token = signFallPollToken(EMAIL, "in")!;
    delete process.env.FALL_POLL_SECRET;
    delete process.env.NGA_ADMIN_SECRET;
    try {
      expect(signFallPollToken(EMAIL, "in")).toBeNull();
      expect(verifyFallPollToken(token, "in")).toBeNull();
    } finally {
      process.env.FALL_POLL_SECRET = dedicated;
      process.env.NGA_ADMIN_SECRET = legacy;
    }
  });

  test("legacy-signed tokens keep verifying after a dedicated secret appears", () => {
    const dedicated = process.env.FALL_POLL_SECRET;
    delete process.env.FALL_POLL_SECRET;
    const legacyToken = signFallPollToken(EMAIL, "interested")!;
    process.env.FALL_POLL_SECRET = dedicated;
    expect(verifyFallPollToken(legacyToken, "interested")).toBe(
      "parent@example.org",
    );
  });
});

test.describe("fall-poll invite — copy", () => {
  test("carries the WhatsApp group invite in HTML and text", () => {
    const html = fallPollInviteHtml({ firstName: "Dana", links: LINKS });
    const text = fallPollInviteText({ firstName: "Dana", links: LINKS });
    expect(html).toContain(WHATSAPP_PARENT_GROUP_URL);
    expect(text).toContain(WHATSAPP_PARENT_GROUP_URL);
  });

  test("all three answers render at equal weight — every link present in both parts", () => {
    const html = fallPollInviteHtml({ firstName: "Dana", links: LINKS });
    const text = fallPollInviteText({ firstName: "Dana", links: LINKS });
    for (const url of [LINKS.inUrl, LINKS.interestedUrl, LINKS.outUrl]) {
      expect(html).toContain(url);
      expect(text).toContain(url);
    }
  });

  test("quotes the real season terms Sam set", () => {
    const html = fallPollInviteHtml({ firstName: "Dana", links: LINKS });
    const text = fallPollInviteText({ firstName: "Dana", links: LINKS });
    for (const part of [html, text]) {
      expect(part).toContain("$225");
      expect(part).toContain("Sundays");
      // Constant, not a literal — the venue moved to Walter Johnson on
      // 2026-08-27 and a hardcoded name here would have hidden a stale one.
      expect(part).toContain(FALL_POLL_VENUE);
      expect(part).not.toContain("Earle B. Wood");
      expect(part).toContain("Sept 20");
      expect(part).toContain("Oct 25");
      expect(part).toContain("1:00–2:30 PM");
      expect(part).toContain("2:30–4:00 PM");
      // The seat count came out of this template on 2026-08-29 — Green and
      // Yellow no longer hold the same number, so one figure here would be
      // wrong for a group. Scarcity without a count.
      expect(part).toMatch(/limited spots/i);
      expect(part).not.toMatch(/\d+ spots/);
      expect(part).toContain("Green");
      expect(part).toContain("Yellow");
    }
  });

  test("says a tap doesn't charge anything", () => {
    const html = fallPollInviteHtml({ firstName: "Dana", links: LINKS });
    expect(html.toLowerCase()).toContain("doesn&rsquo;t charge");
  });

  test("no signing secret → degrades to the reply-based ask, no dead links", () => {
    const html = fallPollInviteHtml({ firstName: "Dana", links: null });
    const text = fallPollInviteText({ firstName: "Dana", links: null });
    for (const part of [html, text]) {
      expect(part).not.toContain("/api/fall-poll");
      expect(part).toContain("IN");
      expect(part).toContain("INTERESTED");
      expect(part).toContain("OUT");
      expect(part.toLowerCase()).toContain("reply");
    }
  });

  test("subject names the season", () => {
    expect(fallPollInviteSubject()).toContain("Fall");
    expect(fallPollInviteSubject().length).toBeLessThan(90);
  });

  test("escapes a hostile first name", () => {
    const html = fallPollInviteHtml({
      firstName: `<script>alert(1)</script>`,
      links: LINKS,
    });
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
