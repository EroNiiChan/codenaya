import { describe, expect, it, vi } from "vitest";

vi.mock("../url-guard", () => ({
  assertSafeMcpUrl: async (url: string) => ({ ok: true, url: new URL(url) }),
}));
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {
    connect = async () => {
      throw new Error("Unexpected token '<', \"<html>internal admin secret\" is not valid JSON");
    };
    close = async () => {};
  },
}));

import { probeMcpServer } from "./probe";

describe("probeMcpServer", () => {
  it("does not echo the remote response in a protocol failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await probeMcpServer({ url: "https://mcp.example.com/mcp" });

    expect(result).toMatchObject({ ok: false, kind: "protocol" });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
