import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
  platform: vi.fn(),
  openProviderKey: vi.fn(),
  lookup: vi.fn(),
}));

vi.mock("@/lib/convex-client", async () => {
  const { withEnvPlatform } = await import("@/features/ai-providers/server/active-platform.mock");
  return {
    convex: { query: withEnvPlatform(mocks.query, mocks.platform), mutation: mocks.mutation },
  };
});
vi.mock("./sealed-key", () => ({ openProviderKey: mocks.openProviderKey }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));

import { DEFAULT_AGENT_MODEL_ID } from "@/features/conversations/agent-models";

import {
  ModelChoiceError,
  ProviderKeyError,
  isProviderKeyRejection,
  requireModelChoice,
  resolveRunModel,
  takePromoRun,
  validateModelChoice,
} from "./resolve-run-model";

const SECRET = "sk-user-secret-key-1234";

const openAiKey = {
  _id: "key_1",
  userId: "user_1",
  provider: "openai" as const,
  label: "Work key",
  status: "active" as const,
};

const customKey = {
  _id: "key_2",
  userId: "user_1",
  provider: "custom" as const,
  label: "Groq",
  baseUrl: "https://api.groq.test/openai/v1",
  modelIds: ["llama-4-scout"],
  status: "active" as const,
};

/** The admin switched to Groq in /admin and saved two models; the env still says OpenRouter. */
const GROQ_SAVED = {
  provider: "groq",
  config: {
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", vendor: "meta", vision: false },
      { id: "qwen/qwen3-32b", name: "Qwen3 32B", vendor: "qwen", vision: true },
    ],
    defaultModelId: "llama-3.3-70b-versatile",
  },
};

/** The admin saved one OpenRouter model, so Claude needs the promotion (ADR 0009). */
const OPENROUTER_SAVED = {
  provider: "openrouter",
  config: {
    models: [{ id: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash", vendor: "google", vision: true }],
    defaultModelId: "google/gemini-3.8-flash",
  },
};

/** The model and endpoint an AgentKit adapter was built for. */
const target = (model: unknown) => {
  const { url, authKey, options } = model as {
    url: string;
    authKey: string;
    options: { model: string };
  };
  return { url, id: options.model, authKey };
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_AI_PROVIDER", "");
  vi.stubEnv("OPENROUTER_API_KEY", "sk-or-platform");
  mocks.openProviderKey.mockResolvedValue(SECRET);
  mocks.lookup.mockResolvedValue([{ address: "104.18.32.7", family: 4 }]);
});

describe("validateModelChoice (API route)", () => {
  const validate = (model: Parameters<typeof validateModelChoice>[0]["model"]) =>
    validateModelChoice({ internalKey: "ik", userId: "user_1", model });

  it("keeps the allowlist fallback for platform models, string or object", async () => {
    expect(await validate("anthropic/claude-opus-5.5")).toEqual({
      modelId: "anthropic/claude-opus-5.5",
      label: "Codenaya · Claude Opus 5.5",
    });
    expect(await validate({ modelId: "evil/model" })).toMatchObject({
      modelId: DEFAULT_AGENT_MODEL_ID,
    });
    expect(await validate(undefined)).toMatchObject({ modelId: DEFAULT_AGENT_MODEL_ID });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("resolves platform ids against the env provider, so old ids keep working", async () => {
    vi.stubEnv("NEXT_PUBLIC_AI_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-platform");

    // An OpenRouter id saved before the switch runs on the new default.
    expect(await validate("anthropic/claude-opus-5.5")).toEqual({
      modelId: "claude-sonnet-5-5",
      label: "Codenaya · Claude Sonnet 5.5",
    });
    expect(await validate("claude-opus-5-5")).toMatchObject({ modelId: "claude-opus-5-5" });
    // AgentKit's Anthropic adapter is text-only.
    await expect(
      validateModelChoice({ internalKey: "ik", userId: "user_1", model: "claude-opus-5-5", withImages: true }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("uses the admin's saved provider and models over the env", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk-platform");
    mocks.platform.mockReturnValue(GROQ_SAVED);

    // An OpenRouter id from before the switch runs on the saved default.
    expect(await validate("anthropic/claude-opus-5.5")).toEqual({
      modelId: "llama-3.3-70b-versatile",
      label: "Codenaya · Llama 3.3 70B",
    });
    expect(await validate("qwen/qwen3-32b")).toMatchObject({ modelId: "qwen/qwen3-32b" });
    // Vision comes from the saved selection.
    const withImages = (model: string) =>
      validateModelChoice({ internalKey: "ik", userId: "user_1", model, withImages: true });
    await expect(withImages("llama-3.3-70b-versatile")).rejects.toMatchObject({ status: 400 });
    expect(await withImages("qwen/qwen3-32b")).toMatchObject({ modelId: "qwen/qwen3-32b" });
  });

  it("refuses with 503 when the saved provider's key is missing, whatever the env has", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.platform.mockReturnValue(GROQ_SAVED);

    await expect(validate("qwen/qwen3-32b")).rejects.toMatchObject({
      status: 503,
      code: "ai_not_configured",
    });
  });

  it("refuses platform models with 503 ai_not_configured when the provider has no key", async () => {
    vi.stubEnv("NEXT_PUBLIC_AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { rejected } = await requireModelChoice({ internalKey: "ik", userId: "user_1", model: undefined });
    expect(rejected?.status).toBe(503);
    const body = await rejected?.json();
    expect(body).toMatchObject({ code: "ai_not_configured" });
    // The user sees what to do; the variable name stays in the server log.
    expect(body.error).toContain("Settings → AI providers");
    expect(body.error).not.toContain("GROQ_API_KEY");

    // BYOK doesn't need the platform key.
    mocks.query.mockResolvedValue(openAiKey);
    expect(await validate({ keyId: "key_1", modelId: "gpt-5.6-luna" })).toMatchObject({
      keyId: "key_1",
    });
  });

  it("refuses a key the caller does not own with 403", async () => {
    mocks.query.mockResolvedValue(null);
    await expect(validate({ keyId: "key_other", modelId: "gpt-5.6-luna" })).rejects.toMatchObject({
      status: 403,
    });
    expect(mocks.query).toHaveBeenCalledWith(expect.anything(), {
      internalKey: "ik",
      keyId: "key_other",
      userId: "user_1",
    });
  });

  it("treats a malformed key id like a foreign one", async () => {
    mocks.query.mockRejectedValue(new Error("ArgumentValidationError"));
    await expect(validate({ keyId: "nope", modelId: "x" })).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a model the key's provider does not offer with 400", async () => {
    mocks.query.mockResolvedValue(openAiKey);
    await expect(
      validate({ keyId: "key_1", modelId: "openai/gpt-5.6-luna" }),
    ).rejects.toMatchObject({ status: 400 });

    mocks.query.mockResolvedValue(customKey);
    await expect(validate({ keyId: "key_2", modelId: "gpt-5.6-luna" })).rejects.toBeInstanceOf(
      ModelChoiceError,
    );
  });

  it("accepts an owned key with one of its models, labelled for the run block", async () => {
    mocks.query.mockResolvedValue(openAiKey);
    expect(await validate({ keyId: "key_1", modelId: "gpt-5.6-luna" })).toEqual({
      keyId: "key_1",
      modelId: "gpt-5.6-luna",
      label: "OpenAI · GPT-5.6 Luna",
    });

    mocks.query.mockResolvedValue(customKey);
    expect(await validate({ keyId: "key_2", modelId: "llama-4-scout" })).toMatchObject({
      label: "Groq · llama-4-scout",
    });
  });

  it("with images, refuses a model that can't read them", async () => {
    const withImages = (model: Parameters<typeof validate>[0]) =>
      validateModelChoice({ internalKey: "ik", userId: "user_1", model, withImages: true });

    expect(await withImages("anthropic/claude-opus-5.5")).toMatchObject({
      modelId: "anthropic/claude-opus-5.5",
    });
    await expect(withImages("z-ai/glm-5.3")).rejects.toMatchObject({
      status: 400,
      message: "Codenaya · GLM 5.3 can't read images. Pick a vision model to send them.",
    });
    // Text-only messages may still use it.
    expect(await validate("z-ai/glm-5.3")).toMatchObject({ modelId: "z-ai/glm-5.3" });

    mocks.query.mockResolvedValue(openAiKey);
    expect(await withImages({ keyId: "key_1", modelId: "gpt-5.6-luna" })).toMatchObject({
      keyId: "key_1",
    });

    // Custom endpoints can't be checked, so they are trusted.
    mocks.query.mockResolvedValue(customKey);
    expect(await withImages({ keyId: "key_2", modelId: "llama-4-scout" })).toMatchObject({
      keyId: "key_2",
    });

    mocks.query.mockResolvedValue({ ...openAiKey, provider: "anthropic" as const });
    await expect(
      withImages({ keyId: "key_1", modelId: "claude-opus-5-5" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("maps refusals to JSON responses for routes", async () => {
    mocks.query.mockResolvedValue(null);
    const { rejected } = await requireModelChoice({
      internalKey: "ik",
      userId: "user_1",
      model: { keyId: "key_other", modelId: "gpt-5.6-luna" },
    });
    expect(rejected?.status).toBe(403);
    expect(await rejected?.json()).toEqual({ error: "AI provider key not found" });
  });
});

describe("validateModelChoice: promo models (ADR 0009)", () => {
  const validate = (model: string, withImages = false) =>
    validateModelChoice({ internalKey: "ik", userId: "user_1", model, withImages });

  it("accepts a claimant's promo model the selection lacks, without taking a run", async () => {
    mocks.platform.mockReturnValue(OPENROUTER_SAVED);
    mocks.query.mockResolvedValue({ opusRunsUsed: 3 });

    expect(await validate("anthropic/claude-opus-5.5")).toEqual({
      modelId: "anthropic/claude-opus-5.5",
      label: "Codenaya · Claude Opus 5.5",
      promoKind: "opus",
    });
    expect(mocks.query).toHaveBeenCalledWith(expect.anything(), { internalKey: "ik", userId: "user_1" });
    expect(mocks.mutation).not.toHaveBeenCalled();

    // Routes get the kind apart from what the message records.
    expect(
      await requireModelChoice({ internalKey: "ik", userId: "user_1", model: "anthropic/claude-sonnet-5.5" }),
    ).toEqual({
      runModel: { modelId: "anthropic/claude-sonnet-5.5", label: "Codenaya · Claude Sonnet 5.5" },
      promoKind: "sonnet",
    });
  });

  it("refuses with the claim's reason instead of falling back", async () => {
    mocks.platform.mockReturnValue(OPENROUTER_SAVED);
    mocks.query.mockResolvedValue({ opusRunsUsed: 20 });

    const { rejected } = await requireModelChoice({
      internalKey: "ik",
      userId: "user_1",
      model: "anthropic/claude-opus-5.5",
    });
    expect(rejected?.status).toBe(403);
    expect(await rejected?.json()).toMatchObject({
      code: "promo_opus_used_up",
      error: expect.stringContaining("Sonnet 5.5 is still free"),
    });

    mocks.query.mockResolvedValue(null);
    await expect(validate("anthropic/claude-sonnet-5.5")).rejects.toMatchObject({
      status: 403,
      code: "promo_not_claimed",
    });
  });

  it("checks images before reading the claim", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-platform");
    mocks.platform.mockReturnValue({
      provider: "anthropic",
      config: {
        models: [{ id: "claude-fable-5-1", name: "Claude Fable 5.1", vendor: "anthropic", vision: false }],
        defaultModelId: "claude-fable-5-1",
      },
    });

    await expect(validate("claude-opus-5-5", true)).rejects.toMatchObject({ status: 400 });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("needs no claim when the selection already offers the model to everyone", async () => {
    expect(await validate("anthropic/claude-opus-5.5")).toMatchObject({
      modelId: "anthropic/claude-opus-5.5",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});

describe("takePromoRun (send routes, ADR 0009)", () => {
  const take = (promoKind?: "opus" | "sonnet") =>
    takePromoRun({ internalKey: "ik", userId: "user_1", promoKind });
  const args = { internalKey: "ik", userId: "user_1", kind: "opus" };

  it("takes nothing for a choice that isn't a promo model", async () => {
    await (await take()).promoRun?.refund();

    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("takes the run, and a refund gives back the same kind", async () => {
    mocks.mutation.mockResolvedValue(null);

    const { promoRun, rejected } = await take("opus");
    expect(rejected).toBeUndefined();
    await promoRun?.refund();

    expect(mocks.mutation).toHaveBeenNthCalledWith(1, expect.anything(), args);
    expect(mocks.mutation).toHaveBeenNthCalledWith(2, expect.anything(), args);
  });

  it("answers a lost race for the last run with the refusal", async () => {
    mocks.mutation.mockResolvedValue("opus_used_up");

    const { rejected } = await take("opus");
    expect(rejected?.status).toBe(403);
    expect(await rejected?.json()).toMatchObject({ code: "promo_opus_used_up" });
  });

  it("logs a failed refund instead of throwing over the route's response", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.mutation.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Convex down"));

    const { promoRun } = await take("opus");
    await expect(promoRun?.refund()).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();
  });
});

describe("resolveRunModel (agent run)", () => {
  const resolve = (choice: { keyId?: string; modelId: string }) =>
    resolveRunModel({ internalKey: "ik", projectId: "p1" as never, choice });

  it("runs platform choices on the platform OpenRouter key", async () => {
    const run = await resolve({ modelId: "x-ai/grok-4.7" });

    expect(run.key).toBeUndefined();
    expect(target(run.coding(0.3))).toMatchObject({
      id: "x-ai/grok-4.7",
      authKey: "sk-or-platform",
    });
    expect(target(run.title(0)).url).toContain("openrouter.ai");
    expect(mocks.openProviderKey).not.toHaveBeenCalled();
  });

  it("runs platform choices on the env provider's key and models", async () => {
    vi.stubEnv("NEXT_PUBLIC_AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "gsk-platform");

    const run = await resolve({ modelId: "x-ai/grok-4.7" });

    expect(target(run.coding(0.3))).toMatchObject({
      id: "openai/gpt-oss-120b",
      authKey: "gsk-platform",
    });
    expect(target(run.coding()).url).toContain("api.groq.com/openai/v1");
    expect(target(run.title(0)).id).toBe("openai/gpt-oss-20b");
  });

  it("runs on the admin's saved provider and models over the env", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk-platform");
    mocks.platform.mockReturnValue(GROQ_SAVED);

    const run = await resolve({ modelId: "x-ai/grok-4.7" });

    expect(target(run.coding(0.3))).toMatchObject({
      id: "llama-3.3-70b-versatile",
      authKey: "gsk-platform",
    });
    expect(target(run.coding()).url).toContain("api.groq.com/openai/v1");
  });

  it("runs a promo model for a project whose owner claimed", async () => {
    mocks.platform.mockReturnValue(OPENROUTER_SAVED);
    mocks.query.mockResolvedValue(true);

    const run = await resolve({ modelId: "anthropic/claude-sonnet-5.5" });

    expect(target(run.coding(0.3)).id).toBe("anthropic/claude-sonnet-5.5");
  });

  it("ends a promo run with a pointer to /promo when the owner hasn't claimed", async () => {
    mocks.platform.mockReturnValue(OPENROUTER_SAVED);
    mocks.query.mockResolvedValue(false);

    const error = await resolve({ modelId: "anthropic/claude-opus-5.5" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderKeyError);
    expect((error as Error).message).toContain("/promo");
  });

  it("ends a platform run with a clear reply when the provider has no key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const error = await resolve({ modelId: "x-ai/grok-4.7" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderKeyError);
    expect((error as Error).message).toMatch(/isn't available right now/);
  });

  it("builds BYOK models on the user's key and provider, title on its cheap model", async () => {
    mocks.query.mockResolvedValue(openAiKey);
    const run = await resolve({ keyId: "key_1", modelId: "gpt-6.1-sol" });

    expect(mocks.query).toHaveBeenCalledWith(expect.anything(), {
      internalKey: "ik",
      keyId: "key_1",
      projectId: "p1",
    });
    expect(run.key).toEqual({ _id: "key_1", userId: "user_1", label: "Work key" });
    // The summary carries no key material.
    expect(JSON.stringify(run.key)).not.toContain(SECRET);
    expect(target(run.coding(0.3))).toMatchObject({
      id: "gpt-6.1-sol",
      authKey: SECRET,
    });
    expect(target(run.coding()).url).toContain("api.openai.com");
    expect(target(run.title(0)).id).toBe("gpt-5.4-mini");
  });

  it("uses a custom endpoint's base URL and first model for titles", async () => {
    mocks.query.mockResolvedValue(customKey);
    const run = await resolve({ keyId: "key_2", modelId: "llama-4-scout" });

    expect(target(run.coding()).url).toContain("api.groq.test");
    expect(target(run.title()).id).toBe("llama-4-scout");
  });

  it("refuses a custom endpoint whose host now resolves to a private address", async () => {
    mocks.query.mockResolvedValue(customKey);
    mocks.lookup.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);

    const error = await resolve({ keyId: "key_2", modelId: "llama-4-scout" }).catch((e) => e);

    expect(error).toBeInstanceOf(ProviderKeyError);
    expect(error.message).toContain("link-local (cloud metadata) address is not allowed. Update it");
    expect(mocks.lookup).toHaveBeenCalledWith("api.groq.test", expect.anything());
    // Refused before the key is unsealed, so no request can carry it.
    expect(mocks.openProviderKey).not.toHaveBeenCalled();
  });

  it.each([
    ["a key not owned by the project owner (or deleted)", null, "llama-4-scout"],
    ["a key marked invalid", { ...customKey, status: "invalid" }, "llama-4-scout"],
    ["a model the key no longer offers", customKey, "gpt-5.6-luna"],
  ])("fails with a settings link, no platform fallback, for %s", async (_, row, modelId) => {
    mocks.query.mockResolvedValue(row);

    const error = await resolve({ keyId: "key_2", modelId }).catch((e) => e);

    expect(error).toBeInstanceOf(ProviderKeyError);
    expect(error.message).toContain("(/settings/ai-providers)");
    expect(mocks.openProviderKey).not.toHaveBeenCalled();
  });
});

describe("isProviderKeyRejection", () => {
  it.each([
    new Error("Incorrect API key provided: sk-abc***"),
    new Error("invalid x-api-key"),
    new Error("No auth credentials found"),
    new Error("Insufficient credits. Add more using https://openrouter.ai/credits"),
    new Error("You exceeded your current quota, please check your plan"),
    new Error("Your credit balance is too low to access the Anthropic API."),
    new Error("This request requires more credits, or fewer max_tokens."),
    { message: "step failed", cause: { status: 401 } },
    { error: { message: "Request failed with status 402" } },
  ])("treats %o as the key's fault", (error) => {
    expect(isProviderKeyRejection(error)).toBe(true);
  });

  it.each([
    new Error("Rate limit reached for requests"),
    new Error("The server had an error while processing your request"),
    new Error("fetch failed"),
    undefined,
  ])("leaves %o to the normal failure path", (error) => {
    expect(isProviderKeyRejection(error)).toBe(false);
  });
});
