import { gzipSync } from "node:zlib";
import { Header } from "tar";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserOauthAccessToken: vi.fn(),
  mutation: vi.fn(),
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
    mutation: mocks.mutation,
  },
}));
// Expose the job handler directly; steps run inline.
vi.mock("@/inngest/client", () => ({
  inngest: { createFunction: (_config: unknown, handler: unknown) => handler },
}));

import { importGithubRepo } from "./import-github-repo";
import { MAX_IMPORT_BYTES } from "../server/github-archive";

type Entry = { path: string; body?: string; type?: "File" | "Directory"; size?: number };

// A gzipped tarball shaped like GitHub's: everything under "<owner>-<repo>-<sha>/".
// `size` overrides the header size, to claim a big file without writing one.
function tarball(entries: Entry[]) {
  const blocks = entries.flatMap(({ path, body = "", type = "File", size }) => {
    const data = Buffer.from(body);
    const header = new Header({
      path: path.startsWith("../") ? path : `octocat-Hello-World-abc123/${path}`,
      type,
      size: size ?? data.length,
      mode: 0o644,
      mtime: new Date(0),
    });
    header.encode();
    const padded = Buffer.alloc(Math.ceil(data.length / 512) * 512);
    data.copy(padded);
    return [header.block!, padded];
  });
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}

const fetchMock = vi.fn();

const runJob = () =>
  (importGithubRepo as unknown as (ctx: unknown) => Promise<unknown>)({
    event: {
      data: { owner: "octocat", repo: "Hello-World", projectId: "p1", userId: "user_1" },
    },
    step: { run: (_name: string, fn: () => unknown) => fn() },
  });

const created = (name: string) =>
  mocks.mutation.mock.calls.filter(([, args]) => args.name === name);

describe("importGithubRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CODENAYA_CONVEX_INTERNAL_KEY", "test-key");
    vi.stubGlobal("fetch", fetchMock);
    mocks.getUserOauthAccessToken.mockResolvedValue({ data: [] });
    // File writes return an id; `system.cleanup` (no name) reports it is done.
    mocks.mutation.mockImplementation(async (_fn, args) =>
      args.name ? `id:${args.name}` : { deleted: 0, done: true }
    );
    fetchMock.mockImplementation(
      async () =>
        new Response(
          tarball([
            { path: "", type: "Directory" },
            { path: "src/", type: "Directory" },
            { path: "README.md", body: "# hi" },
            { path: "src/index.ts", body: "export {};" },
          ])
        )
    );
  });

  it("imports a public repo from one unauthenticated archive request (#364)", async () => {
    await expect(runJob()).resolves.toMatchObject({ success: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/octocat/Hello-World/tarball");
    expect(init.headers).not.toHaveProperty("Authorization");
    expect(created("src")[0][1]).toMatchObject({ parentId: undefined });
    expect(created("README.md")[0][1]).toMatchObject({ content: "# hi", parentId: undefined });
    expect(created("index.ts")[0][1]).toMatchObject({ content: "export {};", parentId: "id:src" });
  });

  it("uses the linked account's token", async () => {
    mocks.getUserOauthAccessToken.mockResolvedValue({ data: [{ token: "gho_test" }] });

    await runJob();

    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: "Bearer gho_test",
    });
  });

  it("rejects a repo over the size cap before reading it", async () => {
    fetchMock.mockResolvedValue(
      new Response(tarball([{ path: "huge.bin", size: MAX_IMPORT_BYTES + 1 }]))
    );

    await expect(runJob()).rejects.toThrow("can't be imported");
    expect(created("huge.bin")).toHaveLength(0);
  });

  it("rejects a repo over the file count cap", async () => {
    const files = Array.from({ length: 5001 }, (_, i) => ({ path: `f${i}`, body: "x" }));
    fetchMock.mockResolvedValue(new Response(tarball(files)));

    await expect(runJob()).rejects.toThrow("can't be imported");
    expect(created("f0")).toHaveLength(0);
    // Parsing 5000 entries takes a few seconds under the full parallel suite.
  }, 30_000);

  it("rejects path traversal entries", async () => {
    fetchMock.mockResolvedValue(
      new Response(tarball([{ path: "../passwd", body: "root" }]))
    );

    await expect(runJob()).rejects.toThrow(
      expect.objectContaining({ name: "NonRetriableError", message: expect.stringMatching("Unsafe path") })
    );
    expect(created("passwd")).toHaveLength(0);
  });

  it("fails cleanly when the archive can't be downloaded", async () => {
    fetchMock.mockResolvedValue(new Response("rate limited", { status: 403 }));

    await expect(runJob()).rejects.toThrow("GitHub archive download failed: 403");
  });
});
