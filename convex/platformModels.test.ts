// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ADMIN = { subject: "user_admin", email: "admin@example.com", emailVerified: true };
const INTERNAL_KEY = "test-internal-key";

const model = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: id.toUpperCase(),
  vendor: "acme",
  vision: false,
  tools: "reported" as const,
  inputUsdPerMTok: 3,
  outputUsdPerMTok: 15,
  ...overrides,
});

const setup = () => convexTest(schema, modules);
const asAdmin = () => setup().withIdentity(ADMIN);
type Admin = ReturnType<typeof asAdmin>;

const save = (t: Admin, models: ReturnType<typeof model>[], defaultModelId = models[0]?.id ?? "") =>
  t.mutation(api.platformModels.save, { provider: "openrouter", models, defaultModelId });

const auditSummaries = async (t: Admin) =>
  (
    await t.query(api.platformModels.listAudit, { paginationOpts: { numItems: 10, cursor: null } })
  ).page.map((row) => row.summary);

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAIL", ADMIN.email);
  vi.stubEnv("CODENAYA_CONVEX_INTERNAL_KEY", INTERNAL_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("platformModels.save validation", () => {
  test.each([
    ["no models", []],
    ["more than 50 models", Array.from({ length: 51 }, (_, i) => model(`m${i}`))],
    ["duplicate ids", [model("a"), model("a")]],
    ["a negative price", [model("a", { inputUsdPerMTok: -1 })]],
    ["a NaN price", [model("a", { outputUsdPerMTok: Number.NaN })]],
    ["a price over $1000/M", [model("a", { outputUsdPerMTok: 1001 })]],
    ["a fractional context length", [model("a", { contextLength: 1.5 })]],
    ["an empty name", [model("a", { name: " " })]],
  ])("rejects %s", async (_, models) => {
    const t = asAdmin();
    await expect(save(t, models, "a")).rejects.toMatchObject({
      data: { code: "INVALID_ARGUMENT" },
    });
    expect(await auditSummaries(t)).toEqual([]);
  });

  test("rejects a default that isn't selected", async () => {
    const t = asAdmin();
    await expect(save(t, [model("a")], "b")).rejects.toMatchObject({
      data: { code: "INVALID_ARGUMENT" },
    });
  });

  test("allows a price of 0 for free models", async () => {
    const t = asAdmin();
    await save(t, [model("a", { inputUsdPerMTok: 0, outputUsdPerMTok: 0 })]);
    expect((await t.query(api.platformModels.getForAdmin, { provider: "openrouter" }))?.models)
      .toHaveLength(1);
  });
});

describe("platformModels.save audit", () => {
  test("upserts one doc and audits each save with the diff", async () => {
    const t = asAdmin();
    await save(t, [model("a"), model("b")], "a");
    await save(
      t,
      [model("a", { inputUsdPerMTok: 5 }), model("c", { tools: "confirmed" })],
      "c",
    );

    const config = await t.query(api.platformModels.getForAdmin, { provider: "openrouter" });
    expect(config?.models.map((m) => m.id)).toEqual(["a", "c"]);
    expect(config?.defaultModelId).toBe("c");

    expect(await auditSummaries(t)).toEqual([
      "openrouter: added c ($3/$15); removed b; default → c; price a: $3/$15 → $5/$15; " +
        "tools confirmed by admin: c",
      "openrouter: added a ($3/$15), b ($3/$15); default → a",
    ]);
  });
});

describe("platformModels reads", () => {
  test("getActive hides prices and returns a null config without a doc", async () => {
    const t = asAdmin();
    const active = { fallbackProvider: "openrouter" as const };
    expect(await t.query(api.platformModels.getActive, active)).toEqual({
      provider: "openrouter",
      config: null,
    });

    await save(t, [model("a", { contextLength: 128_000 })]);
    expect(await t.query(api.platformModels.getActive, active)).toEqual({
      provider: "openrouter",
      config: {
        models: [{ id: "a", name: "A", vendor: "acme", vision: false, contextLength: 128_000 }],
        defaultModelId: "a",
      },
    });
    // Another provider's selection is separate.
    expect(
      (await t.query(api.platformModels.getActive, { fallbackProvider: "groq" })).config,
    ).toBeNull();
  });

  test("getActive requires a signed-in user", async () => {
    await expect(
      setup().query(api.platformModels.getActive, { fallbackProvider: "openrouter" }),
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });

  test("getActiveForServer returns prices with the key and rejects a bad key", async () => {
    const t = asAdmin();
    await save(t, [model("a")]);

    const active = await t.query(api.platformModels.getActiveForServer, {
      internalKey: INTERNAL_KEY,
      fallbackProvider: "openrouter",
    });
    expect(active.config?.models[0]).toMatchObject({ inputUsdPerMTok: 3, outputUsdPerMTok: 15 });

    await expect(
      t.query(api.platformModels.getActiveForServer, {
        internalKey: "nope",
        fallbackProvider: "openrouter",
      }),
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });
});

describe("platformModels.setActiveProvider", () => {
  const SWITCH = { internalKey: INTERNAL_KEY, provider: "groq" as const };
  const saveGroq = (t: Admin) =>
    t.mutation(api.platformModels.save, {
      provider: "groq",
      models: [model("llama", { tools: "confirmed" })],
      defaultModelId: "llama",
    });

  test("the saved provider wins over the env fallback, for users and the server", async () => {
    const base = setup();
    const t = base.withIdentity(ADMIN);
    await saveGroq(t);
    await t.mutation(api.platformModels.setActiveProvider, SWITCH);

    const user = base.withIdentity({ subject: "user_x" });
    const forUser = await user.query(api.platformModels.getActive, { fallbackProvider: "openrouter" });
    expect(forUser.provider).toBe("groq");
    expect(forUser.config?.defaultModelId).toBe("llama");
    const forServer = await t.query(api.platformModels.getActiveForServer, {
      internalKey: INTERNAL_KEY,
      fallbackProvider: "openrouter",
    });
    expect(forServer).toMatchObject({ provider: "groq", config: { defaultModelId: "llama" } });

    expect((await auditSummaries(t))[0]).toBe("env default → groq");
  });

  test("rejects a provider without saved models", async () => {
    await expect(
      asAdmin().mutation(api.platformModels.setActiveProvider, SWITCH),
    ).rejects.toMatchObject({ data: { code: "CONFLICT" } });
  });

  test("a non-admin is rejected even with the internal key", async () => {
    const base = setup();
    await saveGroq(base.withIdentity(ADMIN));
    await expect(
      base.withIdentity({ subject: "user_x", email: "x@example.com", emailVerified: true })
        .mutation(api.platformModels.setActiveProvider, SWITCH),
    ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  });

  test("the admin can't call it from the browser, without the internal key", async () => {
    // The key check on the provider's API key lives in POST /api/admin/provider.
    const t = asAdmin();
    await saveGroq(t);
    await expect(
      t.mutation(api.platformModels.setActiveProvider, { ...SWITCH, internalKey: "guess" }),
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });
});
