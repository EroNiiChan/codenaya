import { describe, expect, it } from "vitest";

import { githubRepoUrl, parseGithubRepo } from "./github-repo";

describe("parseGithubRepo", () => {
  it.each([
    ["octocat/Hello-World", "octocat/Hello-World"],
    ["  vercel/next.js  ", "vercel/next.js"],
    ["https://github.com/vercel/next.js", "vercel/next.js"],
    ["https://github.com/vercel/next.js/", "vercel/next.js"],
    ["https://github.com/acme/widgets.git", "acme/widgets"],
    ["a/.github", "a/.github"],
    ["https://github.com/vercel/next.js/tree/canary", "vercel/next.js"],
    ["https://github.com/vercel/next.js/tree/v15.0.0/packages/next", "vercel/next.js"],
    ["https://github.com/vercel/next.js/blob/canary/README.md", "vercel/next.js"],
    ["https://github.com/acme/widgets.git/", "acme/widgets"],
    ["https://github.com/acme/widgets?tab=readme-ov-file", "acme/widgets"],
    ["https://github.com/acme/widgets#readme", "acme/widgets"],
    ["https://github.com/acme/widgets/tree/main?x=1#y", "acme/widgets"],
    ["http://github.com/acme/widgets", "acme/widgets"],
    ["HTTPS://GitHub.com/acme/widgets", "acme/widgets"],
    ["octocat/Hello-World/tree/main", "octocat/Hello-World"],
    ["ssh://git@github.com/acme/widgets.git", "acme/widgets"],
    ["git://github.com/acme/widgets.git", "acme/widgets"],
    ["https:/github.com/acme/widgets", "acme/widgets"],
    ["https://user:token@github.com/acme/widgets", "acme/widgets"],
    ["https://github.com:443/acme/widgets", "acme/widgets"],
    ["https://github.com/x/../acme/widgets", "acme/widgets"],
  ])("normalises %j to %j", (input, slug) => {
    expect(parseGithubRepo(input)).toBe(slug);
  });

  it.each([
    "",
    "octocat",
    "../etc/passwd",
    "octocat/..",
    "octocat/.",
    "octo.cat/repo",
    "octocat/re po",
    "https://www.github.com/octocat/repo",
    "https://github.com/octocat",
    "https://github.com/",
    "https://github.com/octocat/..",
    "https://github.com/octo.cat/repo/tree/main",
    "https://github.com/octocat/re%20po",
    "https://",
    "javascript:alert(1)",
    "file:///acme/widgets",
    "git@github.com:acme/widgets.git",
    "https://github.com/acme/../..",
    "https://gitlab.com/octocat/repo",
    "https://evil.com/?x=https://github.com/octocat/repo",
    "https://github.com.evil.com/octocat/repo",
    `${"a".repeat(40)}/repo`,
    `octocat/${"r".repeat(101)}`,
  ])("rejects %j", (input) => {
    expect(parseGithubRepo(input)).toBeNull();
  });

  it("round-trips through githubRepoUrl", () => {
    expect(parseGithubRepo(githubRepoUrl("octocat/Hello-World"))).toBe("octocat/Hello-World");
  });
});
