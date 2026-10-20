const GITHUB_URL_PREFIX = "https://github.com/";
// GitHub's own limits: owners are letters, digits and hyphens (max 39), repos
// add dots and underscores (max 100). "." and ".." are not repo names.
const REPO_SLUG = /^[A-Za-z0-9-]{1,39}\/(?!\.\.?$)[A-Za-z0-9._-]{1,100}$/;

/**
 * Normalises `owner/repo` or `https://github.com/owner/repo` (optionally with
 * a trailing `/` or `.git`) to `owner/repo`, or returns null. Strict on
 * purpose: the result is sent to the GitHub API and put into URLs.
 */
export const parseGithubRepo = (input: string): string | null => {
  let slug = input.trim();
  if (slug.startsWith(GITHUB_URL_PREFIX)) slug = slug.slice(GITHUB_URL_PREFIX.length);
  slug = slug.replace(/\/$/, "").replace(/\.git$/, "");
  return REPO_SLUG.test(slug) ? slug : null;
};

/** The GitHub URL of a repo slug from `parseGithubRepo`. */
export const githubRepoUrl = (slug: string) => `${GITHUB_URL_PREFIX}${slug}`;
