import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getToken: vi.fn(),
  fetchQuery: vi.fn(),
  fetchMutation: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("convex/nextjs", () => ({ fetchQuery: mocks.fetchQuery, fetchMutation: mocks.fetchMutation }));

import { resetRateLimits } from "@/lib/rate-limit";

import { POST } from "./route";

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/admin/provider", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/admin/provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
    vi.stubEnv("CODENAYA_CONVEX_INTERNAL_KEY", "internal");
    vi.stubEnv("GROQ_API_KEY", "gsk-test");
    vi.stubEnv("OPENAI_API_KEY", "");
    mocks.auth.mockResolvedValue({ userId: "user_admin", getToken: mocks.getToken });
    mocks.getToken.mockResolvedValue("jwt");
    mocks.fetchQuery.mockResolvedValue(true);
    mocks.fetchMutation.mockResolvedValue(null);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("switches as the admin, with the internal key", async () => {
    const res = await post({ provider: "groq" });
    expect(res.status).toBe(200);
    expect(mocks.fetchMutation).toHaveBeenCalledWith(
      expect.anything(),
      { internalKey: "internal", provider: "groq" },
      { token: "jwt" },
    );
  });

  it("returns 404 to a non-admin without touching Convex", async () => {
    mocks.fetchQuery.mockResolvedValue(false);
    expect((await post({ provider: "groq" })).status).toBe(404);
    expect(mocks.fetchMutation).not.toHaveBeenCalled();
  });

  it("refuses a provider whose key isn't set", async () => {
    const res = await post({ provider: "openai" });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "ai_not_configured", error: expect.stringContaining("OPENAI_API_KEY") });
    expect(mocks.fetchMutation).not.toHaveBeenCalled();
  });

  it("rejects an unknown provider", async () => {
    expect((await post({ provider: "vertex" })).status).toBe(400);
  });

  it("passes on Convex's refusal of a provider without models", async () => {
    mocks.fetchMutation.mockRejectedValue(
      new ConvexError({ code: "CONFLICT", message: "Save models for groq before making it active" }),
    );
    const res = await post({ provider: "groq" });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "no_models" });
  });
});
