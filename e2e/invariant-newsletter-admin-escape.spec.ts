import { test, expect } from "@playwright/test";
import { newsletterAdminHtml } from "@/lib/email/newsletter-admin";

// Pure spec (no dev server): the admin notification must escape the
// attacker-controlled parentName and email so a signup can't relay arbitrary
// HTML/links into the operator inbox from the NGA sending domain.
// Run: npx playwright test e2e/invariant-newsletter-admin-escape.spec.ts --project=desktop

test.describe("newsletter admin email escaping", () => {
  test("escapes HTML injected via parentName", () => {
    const html = newsletterAdminHtml({
      parentName: '<script>alert(1)</script><a href="https://evil/">x</a>',
      email: "a@b.com",
      childAge: 9,
      notionStatus: "created",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('<a href="https://evil/">');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;a href=&quot;https://evil/&quot;&gt;");
  });

  test("escapes HTML injected via email (incl. the mailto href)", () => {
    const html = newsletterAdminHtml({
      parentName: "Jane",
      email: '"><img src=x onerror=alert(1)>',
      childAge: 10,
      notionStatus: "created",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
    // The only <a ...> tag is the template's own mailto row, not an injected one.
    expect((html.match(/<a /g) || []).length).toBe(1);
  });

  test("renders a legitimate signup unchanged", () => {
    const html = newsletterAdminHtml({
      parentName: "Maria O'Brien",
      email: "maria@example.com",
      childAge: 8,
      notionStatus: "created",
    });
    expect(html).toContain("Maria O&#39;Brien");
    expect(html).toContain("mailto:maria@example.com");
    expect(html).toContain(">8<");
  });
});
