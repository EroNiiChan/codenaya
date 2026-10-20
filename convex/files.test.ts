// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const conflict = (message: string) =>
  expect.objectContaining({ data: { code: "CONFLICT", message } });

test("duplicate names throw a typed CONFLICT the explorer can show (#267)", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "user_alice" });
  const projectId = await t.run((ctx) =>
    ctx.db.insert("projects", { name: "p", ownerId: "user_alice", updatedAt: 0 })
  );
  const file = { projectId, name: "a.ts", content: "" };
  await alice.mutation(api.files.createFile, file);
  await alice.mutation(api.files.createFile, { ...file, name: "b.ts" });
  await alice.mutation(api.files.createFolder, { projectId, name: "src" });

  const duplicate = alice.mutation(api.files.createFile, file);
  await expect(duplicate).rejects.toBeInstanceOf(ConvexError);
  await expect(duplicate).rejects.toEqual(conflict("File already exists"));
  await expect(alice.mutation(api.files.createFolder, { projectId, name: "src" })).rejects.toEqual(
    conflict("Folder already exists")
  );

  const files = await alice.query(api.files.getFolderContents, { projectId });
  const b = files.find((f) => f.name === "b.ts")!;
  await expect(alice.mutation(api.files.renameFile, { id: b._id, newName: "a.ts" })).rejects.toEqual(
    conflict("A file with this name already exists in this location")
  );
});
