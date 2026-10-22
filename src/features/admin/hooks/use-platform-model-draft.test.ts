import { describe, expect, it } from "vitest";

import { type DraftModel, draftProblems, fromFetched, parsePrice, toSaveArgs } from "./use-platform-model-draft";

const row = (overrides: Partial<DraftModel> = {}): DraftModel => ({
  id: "m",
  name: "M",
  vendor: "acme",
  vision: false,
  tools: "reported",
  input: "3",
  output: "15",
  ...overrides,
});

describe("platform model draft", () => {
  it("never treats an empty or out-of-range price as a price", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("  ")).toBeNull();
    expect(parsePrice("-1")).toBeNull();
    expect(parsePrice("1001")).toBeNull();
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice("0")).toBe(0);
    expect(parsePrice("0.15")).toBe(0.15);
  });

  it("blocks save until every model is priced and has tool calling confirmed", () => {
    expect(draftProblems({ models: [], defaultModelId: "" })).toEqual(["Add at least one model"]);
    expect(
      draftProblems({
        models: [row({ id: "a", output: "" }), row({ id: "b", tools: null }), row({ id: "c", tools: null })],
        defaultModelId: "a",
      }),
    ).toEqual(["Set both prices for 1 model", "Confirm tool calling for 2 models"]);
    expect(draftProblems({ models: [row()], defaultModelId: "m" })).toEqual([]);
  });

  it("starts unknown tools unconfirmed, unknown prices empty and Anthropic vision off", () => {
    const fetched = { id: "x", name: "X", vendor: "v", vision: true, tools: null };
    expect(fromFetched(fetched, "groq")).toMatchObject({ tools: null, vision: true, input: "", output: "" });
    expect(fromFetched(fetched, "anthropic").vision).toBe(false);
  });

  it("saves confirmed tools and numeric prices", () => {
    const args = toSaveArgs("groq", {
      models: [row({ tools: "confirmed", input: "0.59", output: "0.79", contextLength: 131072 })],
      defaultModelId: "m",
    });
    expect(args.models[0]).toEqual({
      id: "m",
      name: "M",
      vendor: "acme",
      vision: false,
      contextLength: 131072,
      tools: "confirmed",
      inputUsdPerMTok: 0.59,
      outputUsdPerMTok: 0.79,
    });
  });
});
