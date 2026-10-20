/**
 * The callback page reflects the provider's `error_description`, which anyone
 * can set with a crafted link. It must stay inert text in both the page and the
 * inline script (#222).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/convex-client", () => ({ convex: {} }));

import { GET } from "./route";

const BREAKOUTS = [
  "</script><script>alert(1)</script>",
  '"});alert(1);//',
  "line sep para",
];

async function renderError(description: string) {
  const url = new URL("http://localhost:3000/api/integrations/oauth/callback");
  url.searchParams.set("error", "access_denied");
  url.searchParams.set("error_description", description);
  const response = await GET(new Request(url));
  return { response, html: await response.text() };
}

/** Runs the page's inline script against a fake opener, returning what it posted. */
function runScript(html: string) {
  const script = html.match(/<script>([\s\S]*)<\/script>/)![1];
  const postMessage = vi.fn();
  new Function("window", "setTimeout", script)(
    { opener: { postMessage }, location: { origin: "http://localhost:3000" } },
    () => {},
  );
  return postMessage;
}

describe("GET /api/integrations/oauth/callback", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    vi.stubEnv("CODENAYA_CONVEX_INTERNAL_KEY", "test-key");
  });

  it.each(BREAKOUTS)("keeps error_description %j inert", async (payload) => {
    const { response, html } = await renderError(payload);

    expect(response.status).toBe(400);
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).not.toContain("alert(1)</script>");
    expect(html.split("<script>")[1]).not.toMatch(/[\u2028\u2029]/);

    const postMessage = runScript(html);
    expect(postMessage).toHaveBeenCalledWith(
      {
        source: "codenaya-oauth",
        status: "error",
        message: `The provider declined the request: ${payload}`,
      },
      "http://localhost:3000",
    );
  });

  it("HTML-escapes the message in the page text", async () => {
    const { html } = await renderError("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
  });
});
