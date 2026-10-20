/**
 * The sandbox routes answer 400 for a malformed or invalid body, before they
 * touch Convex or E2B (#235).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  query: vi.fn(),
  sandboxCreate: vi.fn(),
  sandboxConnect: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/convex-client", () => ({ convex: { query: mocks.query } }));
vi.mock("e2b", () => ({
  Sandbox: { create: mocks.sandboxCreate, connect: mocks.sandboxConnect },
  AuthenticationError: class extends Error {},
  RateLimitError: class extends Error {},
}));

import { POST } from "./route";
import { PATCH } from "./[sandboxId]/route";

const params = { params: Promise.resolve({ sandboxId: "sbx_1" }) };

const request = (method: string, body: string) =>
  new Request("http://localhost/api/sandbox", { method, body });

const routes = [
  { name: "POST /api/sandbox", call: (body: string) => POST(request("POST", body)) },
  {
    name: "PATCH /api/sandbox/[sandboxId]",
    call: (body: string) => PATCH(request("PATCH", body), params),
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("E2B_API_KEY", "e2b-test");
  mocks.auth.mockResolvedValue({ userId: "user_1" });
});

describe.each(routes)("$name", ({ call }) => {
  it.each([
    ["malformed JSON", "{not json"],
    ["a missing files array", "{}"],
    ["files that are not an array", '{"files":"index.js"}'],
    ["an empty files array", '{"files":[]}'],
    ["a file without content", '{"files":[{"path":"index.js"}]}'],
    // POST reads `settings.devCommand`, PATCH reads `installCommand`.
    [
      "a non-string command",
      '{"files":[{"path":"a.js","content":""}],"settings":{"devCommand":1},"installCommand":1}',
    ],
  ])("answers 400 for %s without touching Convex or E2B", async (_case, body) => {
    const res = await call(body);

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Invalid request" });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.sandboxCreate).not.toHaveBeenCalled();
    expect(mocks.sandboxConnect).not.toHaveBeenCalled();
  });
});
