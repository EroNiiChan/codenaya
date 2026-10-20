import { afterEach, describe, expect, it, vi } from "vitest";

import { PENDING_INTENT_KEY } from "@/lib/pending-intent";

import { savePendingImport, takePendingImport } from "./pending-import";

const memoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
};

describe("pending import", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores an import intent and returns its repo once", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);

    savePendingImport("octocat/Hello-World");

    expect(JSON.parse(storage.getItem(PENDING_INTENT_KEY)!)).toEqual({
      kind: "import",
      repo: "octocat/Hello-World",
    });
    expect(takePendingImport()).toBe("octocat/Hello-World");
    expect(takePendingImport()).toBeNull();
  });

  it("ignores malformed or foreign intents", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);

    storage.setItem(PENDING_INTENT_KEY, "not json");
    expect(takePendingImport()).toBeNull();

    storage.setItem(PENDING_INTENT_KEY, JSON.stringify({ kind: "remix", showcaseId: "abc" }));
    expect(takePendingImport()).toBeNull();
  });

  it("is a no-op when storage is unavailable", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked, removeItem: blocked });

    expect(() => savePendingImport("octocat/Hello-World")).not.toThrow();
    expect(takePendingImport()).toBeNull();
  });
});
