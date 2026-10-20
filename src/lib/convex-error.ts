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
 * The user-facing message of an `appError`, or `fallback`. A plain `Error`
 * from Convex carries the "[CONVEX M(...)] [Request ID: ...]" wrapper and a
 * stack frame in dev and "Server Error" in production, so it is never shown.
 */
export const appErrorMessage = (error: unknown, fallback: string) =>
  getAppError(error)?.message || fallback;
