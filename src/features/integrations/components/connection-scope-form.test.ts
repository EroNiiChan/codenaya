import { describe, expect, it } from "vitest";

import { getProvider } from "../catalog";
import { describeProviderScope } from "./connection-scope-form";

describe("describeProviderScope", () => {
  it("summarises a query-param string and a list against the provider's options", () => {
    expect(
      describeProviderScope(getProvider("supabase"), {
        projectRef: "  abc123 ",
        features: ["database", "docs"],
      })
    ).toEqual(["Project reference abc123", "2 of 8 feature groups"]);
  });

  it("counts a header list with no declared options without a total", () => {
    expect(describeProviderScope(getProvider("github"), { toolsets: ["repos"] })).toEqual([
      "1 toolsets",
    ]);
  });

  it("reads path segments as declared string fields, in order", () => {
    expect(
      describeProviderScope(getProvider("sentry"), { projectSlug: "web", orgSlug: "acme" })
    ).toEqual(["Organisation slug acme", "Project slug web"]);
  });

  it("omits blank and undeclared fields", () => {
    expect(
      describeProviderScope(getProvider("supabase"), {
        projectRef: "   ",
        features: [],
        orgSlug: "acme",
      })
    ).toEqual([]);
  });

  it("describes nothing for a custom server or a provider with no scope fields", () => {
    expect(describeProviderScope(undefined, { projectRef: "abc" })).toEqual([]);
    expect(describeProviderScope(getProvider("linear"), { projectRef: "abc" })).toEqual([]);
  });
});
