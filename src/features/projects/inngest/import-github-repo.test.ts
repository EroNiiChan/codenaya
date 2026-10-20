import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserOauthAccessToken: vi.fn(),
  octokitOptions: vi.fn(),
  getTree: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    users: { getUserOauthAccessToken: mocks.getUserOauthAccessToken },
  }),
}));
vi.mock("@/lib/convex-client", () => ({
  convex: {
    // getOwnedProject: the user owns the project.
    query: vi.fn(async () => ({ _id: "p1", ownerId: "user_1" })),
    mutation: vi.fn(),
  },
}));
vi.mock("octokit", () => ({
  Octokit: class {
    rest = { git: { getTree: mocks.getTree } };
    constructor(options: unknown) {
      mocks.octokitOptions(options);
    }
  },
}));
// Expose the job handler directly; steps run inline.
vi.mock("@/inngest/client", () => ({
  inngest: { createFunction: (_config: unknown, handler: unknown) => handler },
}));

import { importGithubRepo } from "./import-github-repo";

const runJob = () =>
  (importGithubRepo as unknown as (ctx: unknown) => Promise<unknown>)({
    event: {
      data: { owner: "octocat", repo: "Hello-World", projectId: "p1", userId: "user_1" },
    },
    step: { run: (_name: string, fn: () => unknown) => fn() },
  });

describe("importGithubRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CODENAYA_CONVEX_INTERNAL_KEY", "test-key");
    mocks.getTree.mockResolvedValue({ data: { tree: [] } });
  });

  it("uses the linked account's token", async () => {
    mocks.getUserOauthAccessToken.mockResolvedValue({ data: [{ token: "gho_test" }] });

    await runJob();

    expect(mocks.octokitOptions).toHaveBeenCalledWith({ auth: "gho_test" });
  });

  it("reads a public repo unauthenticated when no account is linked (#364)", async () => {
    mocks.getUserOauthAccessToken.mockResolvedValue({ data: [] });

    await expect(runJob()).resolves.toMatchObject({ success: true });

    expect(mocks.octokitOptions).toHaveBeenCalledWith({ auth: undefined });
    expect(mocks.getTree).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "octocat", repo: "Hello-World" })
    );
  });
});
