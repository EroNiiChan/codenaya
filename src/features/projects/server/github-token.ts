import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { NonRetriableError } from "inngest";

import { convex } from "@/lib/convex-client";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { GITHUB_NOT_LINKED } from "../constants";

/**
 * Returns the user's GitHub OAuth token from their linked Clerk account, or
 * null when no GitHub account is linked.
 */
export async function getGithubToken(userId: string): Promise<string | null> {
  const client = await clerkClient();
  const tokens = await client.users.getUserOauthAccessToken(userId, "github");
  return tokens.data[0]?.token ?? null;
}

/**
 * The GitHub token for a GitHub job, looked up inside the job. Inngest stores
 * event payloads and shows them in its dashboard, so events carry the user id
 * and never the token (#211). Anyone holding the event key can name any user
 * and project, so the user must also own the project. Call it outside
 * `step.run`: step output is persisted too.
 */
export async function requireJobGithubToken(opts: {
  internalKey: string;
  userId: string;
  projectId: Id<"projects">;
}): Promise<string> {
  const project = await convex.query(api.system.getOwnedProject, opts);
  if (!project) {
    throw new NonRetriableError("Project not found");
  }

  const token = await getGithubToken(opts.userId);
  if (!token) {
    throw new NonRetriableError("GitHub account not connected");
  }
  return token;
}

export function githubNotLinkedResponse() {
  return NextResponse.json(
    {
      error: "GitHub account not connected. Connect GitHub in your account settings.",
      code: GITHUB_NOT_LINKED,
    },
    { status: 400 }
  );
}
