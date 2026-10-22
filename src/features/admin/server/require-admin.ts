import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";

import { api } from "../../../../convex/_generated/api";

/**
 * The signed-in admin's Clerk user id, else null (signed out, not the admin,
 * or an unverified email). Convex decides, from `ADMIN_EMAIL` and the verified
 * email in the caller's own token, so the check can't drift from the one every
 * admin Convex function makes. Shared by the proxy, the /admin layout and
 * admin routes; the proxy passes its own session.
 */
export async function adminUserIdOrNull(
  session: Pick<Awaited<ReturnType<typeof auth>>, "userId" | "getToken"> | null = null,
): Promise<string | null> {
  const { userId, getToken } = session ?? (await auth());
  if (!userId) return null;
  const token = await getToken({ template: "convex" });
  if (!token) return null;
  return (await fetchQuery(api.admin.isAdmin, {}, { token })) ? userId : null;
}
