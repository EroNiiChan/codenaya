import { afterEach, describe, expect, it, vi } from "vitest";

import { savePendingIntent, takePendingIntent } from "./pending-intent";

describe("pending intent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("leaves an intent of another kind for the page that owns it", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });

    savePendingIntent({ kind: "remix", showcaseId: "abc123" });

    // The dashboard checks for an import right after sign-in (#231).
    expect(takePendingIntent("import")).toBeNull();
    expect(takePendingIntent("remix")).toEqual({ kind: "remix", showcaseId: "abc123" });
    expect(takePendingIntent("remix")).toBeNull();
  });
});
