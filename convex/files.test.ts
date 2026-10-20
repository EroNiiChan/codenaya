// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ALICE = "user_alice";

/** Two of Alice's projects, one with a folder holding a file. */
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const projectId = await ctx.db.insert("projects", { name: "Mine", ownerId: ALICE, updatedAt: 0 });
    const otherProjectId = await ctx.db.insert("projects", {
      name: "Other",
      ownerId: "user_bob",
      updatedAt: 0,
    });
    const otherFolderId = await ctx.db.insert("files", {
      projectId: otherProjectId,
      name: "secret",
      type: "folder",
      updatedAt: 0,
    });
    const folderId = await ctx.db.insert("files", { projectId, name: "src", type: "folder", updatedAt: 0 });
    const fileId = await ctx.db.insert("files", {
      projectId,
      parentId: folderId,
      name: "app.ts",
      type: "file",
      content: "",
      updatedAt: 0,
    });
    return { projectId, otherFolderId, folderId, fileId };
  });
  return { t, alice: t.withIdentity({ subject: ALICE }), ...ids };
}

describe("files.createFile / createFolder", () => {
  test("reject a parent from another project or a parent that is a file (#239)", async () => {
    const { alice, projectId, otherFolderId, fileId } = await setup();

    for (const parentId of [otherFolderId, fileId]) {
      await expect(
        alice.mutation(api.files.createFile, { projectId, parentId, name: "x.ts", content: "" })
      ).rejects.toThrow("Parent folder not found");
      await expect(
        alice.mutation(api.files.createFolder, { projectId, parentId, name: "x" })
      ).rejects.toThrow("Parent folder not found");
    }
  });

  test("accept a folder of the same project", async () => {
    const { t, alice, projectId, folderId } = await setup();

    await alice.mutation(api.files.createFile, { projectId, parentId: folderId, name: "b.ts", content: "" });
    await alice.mutation(api.files.createFolder, { projectId, parentId: folderId, name: "lib" });

    const children = await t.run((ctx) =>
      ctx.db
        .query("files")
        .withIndex("by_project_parent", (q) => q.eq("projectId", projectId).eq("parentId", folderId))
        .collect()
    );
    expect(children.map((f) => f.name).sort()).toEqual(["app.ts", "b.ts", "lib"]);
  });
});

describe("files.getFilePath", () => {
  test("stops at the project boundary (#239)", async () => {
    const { t, alice, folderId, otherFolderId, fileId } = await setup();
    // A parent link planted before createFile checked parents.
    await t.run((ctx) => ctx.db.patch(folderId, { parentId: otherFolderId }));

    const path = await alice.query(api.files.getFilePath, { id: fileId });
    expect(path.map((p) => p.name)).toEqual(["src", "app.ts"]);
  });
});
