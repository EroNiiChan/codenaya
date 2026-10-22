import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_AGENT_MODEL_ID } from "../conversations/agent-models";
import { platformModels, platformProviderId, resolvePlatformModel } from "./platform";
import { AI_PROVIDERS } from "./registry";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("platformProviderId", () => {
  it.each([
    ["openrouter", "openrouter"],
    ["groq", "groq"],
    [" Anthropic ", "anthropic"],
  ])("reads %j as %s", (value, expected) => {
    vi.stubEnv("NEXT_PUBLIC_AI_PROVIDER", value);
    expect(platformProviderId()).toBe(expected);
  });

  it("defaults to openrouter when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_AI_PROVIDER", "");
    expect(platformProviderId()).toBe("openrouter");
  });

  it("falls back to openrouter on an invalid value, and says so", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const value of ["vertex", "custom", "codenaya"]) {
      vi.stubEnv("NEXT_PUBLIC_AI_PROVIDER", value);
      expect(platformProviderId()).toBe("openrouter");
    }
    // Logged once, not on every request.
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/NEXT_PUBLIC_AI_PROVIDER="vertex"/);
  });
});

describe("resolvePlatformModel", () => {
  it("keeps a listed model", () => {
    expect(resolvePlatformModel("openrouter", null, "x-ai/grok-4.7").id).toBe("x-ai/grok-4.7");
    expect(resolvePlatformModel("groq", null, "openai/gpt-oss-20b").id).toBe("openai/gpt-oss-20b");
  });

  it.each([undefined, "", "openai/not-a-real-model", "OPENAI/GPT-5.6-LUNA", " openai/gpt-5.6-luna"])(
    "falls back to the provider default for %j",
    (id) => {
      expect(resolvePlatformModel("openrouter", null, id).id).toBe(DEFAULT_AGENT_MODEL_ID);
    },
  );

  it("replaces another provider's id (an old conversation's model) with the default", () => {
    expect(resolvePlatformModel("anthropic", null, DEFAULT_AGENT_MODEL_ID).id).toBe(
      AI_PROVIDERS.anthropic.defaultModel,
    );
    expect(resolvePlatformModel("groq", null, "claude-opus-5-5").id).toBe(
      AI_PROVIDERS.groq.defaultModel,
    );
  });

  it("uses an admin selection, its default, then the catalog default", () => {
    const models = [
      { id: "openai/gpt-oss-20b", label: "small" },
      { id: "qwen/qwen3.8-27b", label: "qwen" },
    ];
    expect(platformModels("groq", { models, defaultModelId: "qwen/qwen3.8-27b" })).toBe(models);
    expect(resolvePlatformModel("groq", { models, defaultModelId: "qwen/qwen3.8-27b" }, "nope").id)
      .toBe("qwen/qwen3.8-27b");
    // A removed selection default falls to the catalog default, if listed...
    const withCatalogDefault = [...models, { id: "openai/gpt-oss-120b", label: "big" }];
    expect(
      resolvePlatformModel("groq", { models: withCatalogDefault, defaultModelId: "gone" }, "nope").id,
    ).toBe("openai/gpt-oss-120b");
    // ...else to the first listed model.
    expect(resolvePlatformModel("groq", { models, defaultModelId: "gone" }, "nope").id).toBe(
      "openai/gpt-oss-20b",
    );
  });
});
