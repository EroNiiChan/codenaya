import { describe, expect, it } from "vitest";

import exported from "../next.config";

// `withWorkflow` turns the config into a phase function. The production-server
// phase skips its workflow build.
async function loadConfig() {
  return typeof exported === "function"
    ? exported("phase-production-server", { defaultConfig: {} })
    : exported;
}

describe("next.config security headers", () => {
  it("sends the security headers on every route and hides X-Powered-By", async () => {
    const nextConfig = await loadConfig();
    expect(nextConfig.poweredByHeader).toBe(false);
    const rules = (await nextConfig.headers?.()) ?? [];
    const catchAll = rules.find((rule) => rule.source === "/:path*" && !rule.has);
    const headers = Object.fromEntries(
      (catchAll?.headers ?? []).map(({ key, value }) => [key, value]),
    );
    expect(headers).toMatchObject({
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    expect(headers["Permissions-Policy"]).toContain("camera=()");
  });
});
