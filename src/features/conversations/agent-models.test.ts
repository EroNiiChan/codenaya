import { describe, expect, it } from "vitest";

import { AGENT_MODELS, DEFAULT_AGENT_MODEL_ID } from "./agent-models";

describe("agent model allowlist", () => {
  it("offers 15 unique models including the default", () => {
    const ids = AGENT_MODELS.map((model) => model.id);

    expect(ids).toHaveLength(15);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_AGENT_MODEL_ID);
  });
});
