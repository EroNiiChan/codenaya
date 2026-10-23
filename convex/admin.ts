import type { UserIdentity } from "convex/server";
import { v } from "convex/values";

import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { appError } from "./errors";

/**
 * The single admin is whoever holds the verified email in the `ADMIN_EMAIL`
 * Convex env var. Next.js asks `isAdmin` instead of reading the var, so there
 * is one source. Unset, or an unverified email, fails closed.
 */
export const isAdminIdentity = (identity: UserIdentity | null): boolean => {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return (
    !!adminEmail &&
    identity?.emailVerified === true &&
    identity.email?.trim().toLowerCase() === adminEmail
  );
};

/**
 * First line of every admin function. Anyone else gets NOT_FOUND, the same as
 * a function that doesn't exist, so the admin surface can't be probed.
 */
export const requireAdmin = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || !isAdminIdentity(identity)) {
    throw appError("NOT_FOUND", "Not found");
  }
  return { id: identity.subject, email: identity.email! };
};

export type Admin = Awaited<ReturnType<typeof requireAdmin>>;

/** Records an admin change; call it in the same mutation as the change. */
export const writeAudit = (
  ctx: MutationCtx,
  admin: Admin,
  action: string,
  summary: string,
) =>
  ctx.db.insert("adminAuditLog", {
    actorId: admin.id,
    actorEmail: admin.email,
    action,
    summary,
    at: Date.now(),
  });

/** Whether the caller is the admin. Gates the /admin layout and nav link. */
export const isAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => isAdminIdentity(await ctx.auth.getUserIdentity()),
});
