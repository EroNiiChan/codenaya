// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ADMIN = { subject: "user_admin", email: "admin@example.com", emailVerified: true };
const OTHER = { subject: "user_other", email: "other@example.com", emailVerified: true };

const MODEL = {
  id: "openai/gpt-5.4-mini",
  name: "GPT-5.4 mini",
  vendor: "openai",
  vision: true,
  tools: "reported" as const,
  inputUsdPerMTok: 0.25,
  outputUsdPerMTok: 2,
};
const SAVE = { provider: "openrouter" as const, models: [MODEL], defaultModelId: MODEL.id };
const PAGE = { paginationOpts: { numItems: 10, cursor: null } };

const setup = () => convexTest(schema, modules);

const expectNotFound = (promise: Promise<unknown>) =>
  expect(promise).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireAdmin", () => {
  test("the admin can save, and exactly one audit row is written", async () => {
    const t = setup();
    const admin = t.withIdentity(ADMIN);

    expect(await admin.query(api.admin.isAdmin, {})).toBe(true);
    await admin.mutation(api.platformModels.save, SAVE);

    const audit = await admin.query(api.platformModels.listAudit, PAGE);
    expect(audit.page).toHaveLength(1);
    expect(audit.page[0]).toMatchObject({
      actorId: ADMIN.subject,
      actorEmail: ADMIN.email,
      action: "platformModels.save",
    });
  });

  test("a non-admin gets NOT_FOUND from every admin function", async () => {
    const t = setup();
    const other = t.withIdentity(OTHER);

    expect(await other.query(api.admin.isAdmin, {})).toBe(false);
    await expectNotFound(other.mutation(api.platformModels.save, SAVE));
    await expectNotFound(other.query(api.platformModels.listAudit, PAGE));
    await expectNotFound(other.query(api.platformModels.getForAdmin, { provider: "openrouter" }));
  });

  test("signed out is not admin", async () => {
    const t = setup();
    expect(await t.query(api.admin.isAdmin, {})).toBe(false);
    await expectNotFound(t.mutation(api.platformModels.save, SAVE));
  });

  test("an unverified admin email is not admin", async () => {
    const t = setup();
    const unverified = t.withIdentity({ ...ADMIN, emailVerified: false });

    expect(await unverified.query(api.admin.isAdmin, {})).toBe(false);
    await expectNotFound(unverified.mutation(api.platformModels.save, SAVE));
    // A missing claim counts as unverified too.
    const { emailVerified: _, ...noClaim } = ADMIN;
    expect(await t.withIdentity(noClaim).query(api.admin.isAdmin, {})).toBe(false);
  });

  test("with ADMIN_EMAIL unset nobody is admin", async () => {
    vi.stubEnv("ADMIN_EMAIL", "");
    const t = setup();
    const admin = t.withIdentity(ADMIN);

    expect(await admin.query(api.admin.isAdmin, {})).toBe(false);
    await expectNotFound(admin.mutation(api.platformModels.save, SAVE));
  });

  test("case and whitespace variants of the email match", async () => {
    vi.stubEnv("ADMIN_EMAIL", "  Admin@Example.COM ");
    const t = setup();

    expect(
      await t
        .withIdentity({ ...ADMIN, email: "ADMIN@example.com" })
        .query(api.admin.isAdmin, {}),
    ).toBe(true);
  });
});
