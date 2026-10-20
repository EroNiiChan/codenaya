import { beforeEach, describe, expect, it, vi } from "vitest";

const open = vi.hoisted(() => vi.fn());

vi.mock("../crypto", () => ({
  getSecretSealer: () => ({ open }),
  secretContext: (...parts: string[]) => parts.join(":"),
}));

import { resolveProjectEnv, secretValuesFrom, type EnvVarRecord } from "./resolve-env";

const envelope = {
  kekProvider: "local",
  kekKeyId: "k1",
  wrappedDek: "dek",
  ciphertext: "ct",
  iv: "iv",
  authTag: "tag",
};

const secret = (key: string, extra: Partial<EnvVarRecord> = {}): EnvVarRecord => ({
  _id: key,
  key,
  visibility: "secret",
  secretRef: `ref_${key}`,
  ...envelope,
  ...extra,
});

describe("resolveProjectEnv", () => {
  beforeEach(() => {
    open.mockReset();
    open.mockImplementation(async (sealed, context) => `plain(${sealed.ciphertext}@${context})`);
  });

  it("keeps public and secret values in separate sets", async () => {
    const resolved = await resolveProjectEnv([
      { _id: "1", key: "NEXT_PUBLIC_URL", visibility: "public", plainValue: "https://x" },
      secret("DB_URL"),
    ]);

    expect(resolved).toEqual({
      publicEntries: [{ key: "NEXT_PUBLIC_URL", value: "https://x" }],
      secretEntries: [{ key: "DB_URL", value: "plain(ct@projectEnvVars:ref_DB_URL:value)" }],
      failedKeys: [],
    });
  });

  it("skips a public row with no value", async () => {
    const resolved = await resolveProjectEnv([{ _id: "1", key: "EMPTY", visibility: "public" }]);

    expect(resolved.publicEntries).toEqual([]);
    expect(resolved.failedKeys).toEqual([]);
  });

  it("reports a secret it cannot open by key, without failing the rest", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    open.mockImplementation(async (sealed) => {
      if (sealed.ciphertext === "bad") throw new Error("auth tag mismatch");
      return "ok";
    });

    const resolved = await resolveProjectEnv([
      secret("MISSING_FIELDS", { iv: undefined }),
      secret("TAMPERED", { ciphertext: "bad" }),
      secret("GOOD"),
    ]);

    expect(resolved.failedKeys).toEqual(["MISSING_FIELDS", "TAMPERED"]);
    expect(resolved.secretEntries).toEqual([{ key: "GOOD", value: "ok" }]);
    expect(open).toHaveBeenCalledTimes(2);
  });
});

describe("secretValuesFrom", () => {
  it("returns every secret value and no public one", () => {
    expect(
      secretValuesFrom({
        publicEntries: [{ key: "PUBLIC", value: "visible" }],
        secretEntries: [
          { key: "A", value: "s1" },
          { key: "B", value: "s2" },
        ],
        failedKeys: [],
      })
    ).toEqual(["s1", "s2"]);
  });
});
