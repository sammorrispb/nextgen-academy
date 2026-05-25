import { test, expect } from "@playwright/test";
import { validatePollVote } from "../src/lib/validate-poll-vote";

test.describe("validatePollVote", () => {
  const goodInput = {
    parentName: "Pat Parent",
    email: "pat@example.com",
    childFirstName: "Avery",
    childAge: "10",
    childLevel: "Green" as const,
    vote: "Yes" as const,
  };

  test("accepts a complete valid form", () => {
    expect(validatePollVote(goodInput)).toEqual({});
  });

  test("flags missing parent name", () => {
    expect(validatePollVote({ ...goodInput, parentName: "" })).toHaveProperty(
      "parentName",
    );
  });

  test("flags malformed email", () => {
    expect(validatePollVote({ ...goodInput, email: "not-an-email" })).toHaveProperty(
      "email",
    );
  });

  test("flags missing child first name", () => {
    expect(
      validatePollVote({ ...goodInput, childFirstName: "" }),
    ).toHaveProperty("childFirstName");
  });

  test("flags age outside 6-16 range", () => {
    expect(validatePollVote({ ...goodInput, childAge: "5" })).toHaveProperty(
      "childAge",
    );
    expect(validatePollVote({ ...goodInput, childAge: "17" })).toHaveProperty(
      "childAge",
    );
    expect(validatePollVote({ ...goodInput, childAge: "12" }).childAge).toBeUndefined();
  });

  test("flags invalid level", () => {
    expect(
      // @ts-expect-error — intentionally invalid level
      validatePollVote({ ...goodInput, childLevel: "Blue" }),
    ).toHaveProperty("childLevel");
  });

  test("flags missing vote", () => {
    expect(validatePollVote({ ...goodInput, vote: undefined })).toHaveProperty(
      "vote",
    );
  });
});
