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
    "octocat/repo/tree/main",
    "octocat/re po",
    "http://github.com/octocat/repo",
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
