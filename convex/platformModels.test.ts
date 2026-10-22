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
  test("list hides prices and returns null without a doc", async () => {
    const t = asAdmin();
    expect(await t.query(api.platformModels.list, { provider: "openrouter" })).toBeNull();

    await save(t, [model("a", { contextLength: 128_000 })]);
    expect(await t.query(api.platformModels.list, { provider: "openrouter" })).toEqual({
      models: [{ id: "a", name: "A", vendor: "acme", vision: false, contextLength: 128_000 }],
      defaultModelId: "a",
    });
    // Another provider's selection is separate.
    expect(await t.query(api.platformModels.list, { provider: "groq" })).toBeNull();
  });

  test("list requires a signed-in user", async () => {
    await expect(
      setup().query(api.platformModels.list, { provider: "openrouter" }),
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });

  test("getForServer returns prices with the key and rejects a bad key", async () => {
    const t = asAdmin();
    await save(t, [model("a")]);

    const config = await t.query(api.platformModels.getForServer, {
      internalKey: INTERNAL_KEY,
      provider: "openrouter",
    });
    expect(config?.models[0]).toMatchObject({ inputUsdPerMTok: 3, outputUsdPerMTok: 15 });

    await expect(
      t.query(api.platformModels.getForServer, { internalKey: "nope", provider: "openrouter" }),
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });
});
