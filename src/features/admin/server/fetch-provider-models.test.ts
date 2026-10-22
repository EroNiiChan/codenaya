import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_FETCHED_MODELS,
  ProviderModelsError,
  fetchProviderModels,
  normalizeProviderModels,
} from "./fetch-provider-models";

describe("normalizeProviderModels", () => {
  it("reads OpenRouter prices per 1M tokens and the tools/vision flags", () => {
    const models = normalizeProviderModels("openrouter", {
      data: [
        {
          id: "anthropic/claude-sonnet-5-5",
          name: "Anthropic: Claude Sonnet 5.5",
          context_length: 1_000_000,
          architecture: { input_modalities: ["text", "image"] },
          pricing: { prompt: "0.000003", completion: "0.000015" },
          supported_parameters: ["tools", "temperature"],
        },
        {
          id: "openrouter/auto",
          name: "Auto Router",
          architecture: { input_modalities: ["text"] },
          pricing: { prompt: "-1", completion: "nope" },
          supported_parameters: ["temperature"],
        },
      ],
    });

    expect(models).toEqual([
      {
        id: "anthropic/claude-sonnet-5-5",
        name: "Anthropic: Claude Sonnet 5.5",
        vendor: "anthropic",
        contextLength: 1_000_000,
        vision: true,
        tools: true,
        inputUsdPerMTok: 3,
        outputUsdPerMTok: 15,
      },
      {
        id: "openrouter/auto",
        name: "Auto Router",
        vendor: "openrouter",
        contextLength: undefined,
        vision: false,
        tools: false,
        inputUsdPerMTok: undefined,
        outputUsdPerMTok: undefined,
      },
    ]);
  });

  it("drops OpenAI non-chat models and leaves tools/vision unknown", () => {
    const models = normalizeProviderModels("openai", {
      data: [
        { id: "gpt-5.4-mini" },
        { id: "text-embedding-3-large" },
        { id: "whisper-1" },
        { id: "gpt-realtime" },
      ],
    });
    expect(models).toEqual([
      { id: "gpt-5.4-mini", name: "gpt-5.4-mini", vendor: "openai", vision: null, tools: null },
    ]);
  });

  it("drops inactive and non-chat Groq models", () => {
    const models = normalizeProviderModels("groq", {
      data: [
        { id: "llama-3.3-70b-versatile", owned_by: "Meta", context_window: 131072, active: true },
        { id: "old-model", active: false },
        { id: "whisper-large-v3" },
        { id: "llama-guard-4-12b" },
      ],
    });
    expect(models).toEqual([
      {
        id: "llama-3.3-70b-versatile",
        name: "llama-3.3-70b-versatile",
        vendor: "meta",
        contextLength: 131072,
        vision: null,
        tools: null,
      },
    ]);
  });

  it("forces Anthropic vision off and reports tools", () => {
    const [model] = normalizeProviderModels("anthropic", {
      data: [{ id: "claude-opus-5-5", display_name: "Claude Opus 5.5", type: "model" }],
    });
    expect(model).toMatchObject({ name: "Claude Opus 5.5", vision: false, tools: true });
  });

  it("drops malformed rows and duplicates", () => {
    const models = normalizeProviderModels("openai", {
      data: [null, "gpt", { id: 42 }, { id: "" }, { id: "x".repeat(201) }, { id: "a" }, { id: "a" }],
    });
    expect(models.map((m) => m.id)).toEqual(["a"]);
  });

  it("caps the list", () => {
    const data = Array.from({ length: MAX_FETCHED_MODELS + 5 }, (_, i) => ({ id: `m${i}` }));
    expect(normalizeProviderModels("openai", { data })).toHaveLength(MAX_FETCHED_MODELS);
  });

  it("rejects a body without a data array", () => {
    expect(() => normalizeProviderModels("openai", { error: "x" })).toThrow(ProviderModelsError);
  });
});

describe("fetchProviderModels", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the key only in the provider's auth header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchProviderModels("anthropic", "sk-ant-secret");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/models?limit=1000");
    expect(init.headers).toEqual({ "x-api-key": "sk-ant-secret", "anthropic-version": "2023-06-01" });
  });

  it("turns an upstream error into ProviderModelsError with its status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    await expect(fetchProviderModels("groq", "k")).rejects.toMatchObject({ status: 500 });
  });

  it("turns a network failure into ProviderModelsError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(fetchProviderModels("openai", "k")).rejects.toBeInstanceOf(ProviderModelsError);
  });
});
