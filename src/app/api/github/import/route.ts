import { z } from "zod";
import { NextResponse } from "next/server";
import { requireUserId } from "@/features/auth/server/require-user-id";
import { parseJsonBody } from "@/lib/parse-json-body";
import {
  GITHUB_IMPORT_RATE_LIMIT,
  checkRateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";

import { convex } from "@/lib/convex-client";
import { inngest } from "@/inngest/client";
import {
  getGithubToken,
  githubNotLinkedResponse,
  isPublicGithubRepo,
} from "@/features/projects/server/github-token";

import { api } from "../../../../../convex/_generated/api";

const requestSchema = z.object({
  url: z.url(),
});

function parseGitHubUrl(url: string) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    return null;
  }

  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

export async function POST(request: Request) {
  const { userId, unauthorized } = await requireUserId();

  if (unauthorized) {
    return unauthorized;
  }

  const rateLimit = checkRateLimit(userId, GITHUB_IMPORT_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit);
  }

  const { data, invalid } = await parseJsonBody(request, requestSchema);

  if (invalid) {
    return invalid;
  }

  const { url } = data;

  const parsedUrl = parseGitHubUrl(url);

  if (!parsedUrl) {
    return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });
  }

  const { owner, repo } = parsedUrl;
  // https://github.com/itsmrad/codenaya
  // { owner: "itsmrad", repo: "codenaya" }

  // Checked here for a clear error; the job looks the token up itself (#211).
  // Public repos import without a linked account (#364).
  if (!(await getGithubToken(userId)) && !(await isPublicGithubRepo(owner, repo))) {
    return githubNotLinkedResponse(
      "This repository is private or doesn't exist. Connect GitHub to import private repositories."
    );
  }

  const internalKey = process.env.CODENAYA_CONVEX_INTERNAL_KEY;

  if (!internalKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const projectId = await convex.mutation(api.system.createProject, {
    internalKey,
    name: repo,
    ownerId: userId,
  });

  const event = await inngest.send({
    name: "github/import.repo",
    data: {
      owner,
      repo,
      projectId,
      userId,
    },
  });

  return NextResponse.json({ 
    success: true, 
    projectId, 
    eventId: event.ids[0]
  });
};
