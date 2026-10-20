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

type JobGithubTokenOpts = {
  internalKey: string;
  userId: string;
  projectId: Id<"projects">;
};

/**
 * The GitHub token for a GitHub job, looked up inside the job. Inngest stores
 * event payloads and shows them in its dashboard, so events carry the user id
 * and never the token (#211). Anyone holding the event key can name any user
 * and project, so the user must also own the project. Call it outside
 * `step.run`: step output is persisted too.
 */
export async function requireJobGithubToken(
  opts: JobGithubTokenOpts
): Promise<string> {
  const token = await getJobGithubToken(opts);
  if (!token) {
    throw new NonRetriableError("GitHub account not connected");
  }
  return token;
}

/**
 * Like `requireJobGithubToken`, but null when no GitHub account is linked, for
 * jobs that can fall back to unauthenticated reads (public repo import, #364).
 */
export async function getJobGithubToken(
  opts: JobGithubTokenOpts
): Promise<string | null> {
  const project = await convex.query(api.system.getOwnedProject, opts);
  if (!project) {
    throw new NonRetriableError("Project not found");
  }
  return getGithubToken(opts.userId);
}

/**
 * Whether anyone can read the repo, checked without a token (#364). False for
 * private and missing repos, which GitHub both answers with 404.
 */
export async function isPublicGithubRepo(owner: string, repo: string) {
  // ponytail: unauthenticated, so 60 requests/hour per server IP; a rate-limited
  // check reads as "not public". Add a server read token if that starts to bite.
  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers: { Accept: "application/vnd.github+json" } }
  );
  if (!res.ok) return false;
  const data: { private?: boolean } = await res.json();
  return data.private === false;
}

export function githubNotLinkedResponse(
  error = "GitHub account not connected. Connect GitHub in your account settings."
) {
  return NextResponse.json(
    {
      error,
      code: GITHUB_NOT_LINKED,
    },
    { status: 400 }
  );
}
