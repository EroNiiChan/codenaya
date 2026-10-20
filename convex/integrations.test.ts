// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ALICE = "user_alice";

/** A pending approval of Alice's, with `overrides` applied. */
async function setup(overrides: Partial<Doc<"mcpApprovals">> = {}) {
  const t = convexTest(schema, modules);
  const id = await t.run(async (ctx) => {
    const now = Date.now();
    const projectId = await ctx.db.insert("projects", { name: "App", ownerId: ALICE, updatedAt: now });
    const userConnectionId = await ctx.db.insert("userConnections", {
      userId: ALICE,
      providerId: "github",
      label: "GitHub",
      authMode: "api_key",
      serverUrl: "https://example.com/mcp",
      status: "active",
      credentialRef: "ref",
      kekProvider: "local",
      kekKeyId: "k",
      wrappedDek: "d",
      ciphertext: "c",
      iv: "i",
      authTag: "a",
      maskedPreview: "****",
      scopes: [],
      createdAt: now,
      updatedAt: now,
    });
    const projectConnectionId = await ctx.db.insert("projectConnections", {
      projectId,
      userConnectionId,
      ownerId: ALICE,
      enabled: true,
      readOnly: false,
      providerScope: {},
      writeApproved: true,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.insert("mcpApprovals", {
      projectId,
      ownerId: ALICE,
      projectConnectionId,
      providerId: "github",
      toolName: "create_issue",
      argsPreview: "{}",
      status: "pending",
      createdAt: now,
      expiresAt: now + 60_000,
      ...overrides,
    });
  });
  return {
    alice: t.withIdentity({ subject: ALICE }),
    bob: t.withIdentity({ subject: "user_bob" }),
    id,
  };
}

// The client picks its toast from `data`, which production keeps when it
// redacts the message (#354).
describe("integrations.resolveApproval", () => {
  test("an already answered approval throws CONFLICT", async () => {
    const { alice, id } = await setup({ status: "approved" });

    await expect(
      alice.mutation(api.integrations.resolveApproval, { id, decision: "denied" }),
    ).rejects.toMatchObject({ data: { code: "CONFLICT", status: "approved" } });
  });

  // Returned, not thrown: a throw rolled back the expiry write (#212).
  test("an approval past its deadline returns expired and stays expired", async () => {
    const { alice, id } = await setup({ expiresAt: Date.now() - 1 });

    await expect(
      alice.mutation(api.integrations.resolveApproval, { id, decision: "approved" }),
    ).resolves.toBe("expired");
    expect(await alice.run((ctx) => ctx.db.get("mcpApprovals", id))).toMatchObject({
      status: "expired",
    });
  });

  test("another user's approval throws FORBIDDEN", async () => {
    const { bob, id } = await setup();

    await expect(
      bob.mutation(api.integrations.resolveApproval, { id, decision: "approved" }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });
});

describe("integrations.listPendingApprovals", () => {
  // Reads no clock (#53): a lapsed row stays listed until the cron marks it.
  test("lists pending rows, oldest first, to the project owner only", async () => {
    const { alice, bob, id } = await setup();
    const approval = (await alice.run((ctx) => ctx.db.get("mcpApprovals", id)))!;
    const row = {
      projectId: approval.projectId,
      ownerId: ALICE,
      projectConnectionId: approval.projectConnectionId,
      providerId: "github",
      toolName: "delete_repo",
      argsPreview: "{}",
      createdAt: approval.createdAt - 1,
      expiresAt: 0,
    };
    const lapsedId = await alice.run((ctx) =>
      ctx.db.insert("mcpApprovals", { ...row, status: "pending" }),
    );
    await alice.run((ctx) => ctx.db.insert("mcpApprovals", { ...row, status: "denied" }));

    const listed = await alice.query(api.integrations.listPendingApprovals, {
      projectId: approval.projectId,
    });
    expect(listed.map((row) => row._id)).toEqual([lapsedId, id]);
    await expect(
      bob.query(api.integrations.listPendingApprovals, { projectId: approval.projectId }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });
});
