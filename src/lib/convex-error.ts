import { ConvexError } from "convex/values";

/**
 * The message of a typed `ConvexError({ code, message })`, else `fallback`.
 * A plain `Error` thrown in a Convex function reaches the client as
 * "Server Error" in production, so its message is never shown (#267).
 */
export const convexErrorMessage = (error: unknown, fallback: string) =>
  error instanceof ConvexError && typeof error.data?.message === "string"
    ? (error.data.message as string)
    : fallback;
