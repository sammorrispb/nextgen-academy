import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import { POST, GET } from "../src/app/api/eval-book/route";

// Public eval scheduling is text-only. Old tabs and links must not reserve
// a slot, accept child data, or send a message. Admin confirmation stays live.
const stub = new FetchStub();
test.beforeEach(() => { stub.reset(); stub.install(); });
test.afterEach(() => stub.uninstall());

for (const body of ["", "not-json", JSON.stringify({
  parentName: "Parent Canary", email: "parent@example.com",
  childFirstName: "ChildCanary", childLastName: "PrivateCanary",
  slotId: "11111111-1111-4111-8111-111111111111", level: "Green",
})]) {
  test(`retired POST ignores payload and returns text scheduling (${body || "empty"})`, async () => {
    const response = await POST(new NextRequest("http://localhost/api/eval-book", {
      method: "POST", body,
    }));
    expect(response.status).toBe(410);
    const result = await response.json();
    expect(result.code).toBe("EVALUATION_TEXT_TO_SCHEDULE");
    expect(result.error).toContain("301-325-4731");
    expect(result.scheduleUrl).toBe("sms:+13013254731");
    expect(JSON.stringify(result)).not.toMatch(/ChildCanary|PrivateCanary|parent@example.com/);
    expect(stub.calls).toEqual([]);
  });
}

test("retired GET does not expose or fetch bookable eval slots", async () => {
  const response = await GET(new NextRequest("http://localhost/api/eval-book"));
  expect(response.status).toBe(410);
  expect(await response.json()).toMatchObject({
    slots: [], code: "EVALUATION_TEXT_TO_SCHEDULE", scheduleUrl: "sms:+13013254731",
  });
  expect(stub.calls).toEqual([]);
});
