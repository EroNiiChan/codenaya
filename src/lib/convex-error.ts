import { ConvexError } from "convex/values";

import type { AppErrorData } from "../../convex/errors";

/**
 * The `{ code, message }` a Convex function threw with `appError`, or null for
 * anything else. Branch on `code`, never on message text: production redacts
 * the message of every error that is not a `ConvexError`.
 */
export const getAppError = (error: unknown): AppErrorData | null => {
  if (!(error instanceof ConvexError)) return null;
  const data: unknown = error.data;
  if (
    typeof data !== "object" ||
    data === null ||
    typeof (data as AppErrorData).code !== "string" ||
    typeof (data as AppErrorData).message !== "string"
  ) {
    return null;
  }
  return data as AppErrorData;
};

/**
 * The message of a typed `ConvexError({ code, message })`, else `fallback`.
 * A plain `Error` thrown in a Convex function reaches the client as
 * "Server Error" in production, so its message is never shown (#267).
 */
export const convexErrorMessage = (error: unknown, fallback: string) =>
  getAppError(error)?.message || fallback;
