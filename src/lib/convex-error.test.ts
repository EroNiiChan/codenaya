import { describe, expect, it } from "vitest";

import { appError } from "../../convex/errors";
import { appErrorMessage, getAppError } from "./convex-error";

/** What a production client receives: the message is gone, `data` is kept. */
const redacted = (error: Error) => {
  error.message = "[Request ID: x] Server Error";
  return error;
};

describe("getAppError", () => {
  it("reads the code from data when the message is redacted", () => {
    const error = redacted(
      appError("CONFLICT", "This request expired before it was answered", { status: "expired" }),
    );
    expect(getAppError(error)).toEqual({
      code: "CONFLICT",
      message: "This request expired before it was answered",
      status: "expired",
    });
  });

  it("returns null for anything that is not an appError", () => {
    expect(getAppError(new Error("Uncaught Error: This request was already approved"))).toBeNull();
    expect(getAppError("CONFLICT")).toBeNull();
    expect(getAppError(undefined)).toBeNull();
  });
});

describe("appErrorMessage", () => {
  it("shows the appError's message even when Convex redacted error.message", () => {
    expect(appErrorMessage(redacted(appError("CONFLICT", "File already exists")), "Failed")).toBe(
      "File already exists",
    );
  });

  it("never shows a plain Error's wrapped dev message or a redacted one", () => {
    const wrapped = new Error(
      "[CONVEX M(skills:create)] [Request ID: x] Server Error\nUncaught Error: boom\n    at handler (../convex/skills.ts:1:1)",
    );
    expect(appErrorMessage(wrapped, "Unable to save the skill")).toBe("Unable to save the skill");
    expect(appErrorMessage(redacted(new Error()), "Failed")).toBe("Failed");
    expect(appErrorMessage(null, "Failed")).toBe("Failed");
  });
});
