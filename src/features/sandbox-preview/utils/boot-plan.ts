/**
 * How a preview engine boots a project (#262). Without a root package.json
 * there is nothing to `npm install`, so a plain index.html site is served as
 * it is, and a project with neither gets a readable message instead of npm's
 * ENOENT exit code. Shared by the E2B route and the WebContainer hook.
 *
 * - `npm`: install, then run the dev command (also whenever the user set
 *   their own dev command, which knows how to run the project).
 * - `static`: skip install and serve the files.
 * - `none`: nothing either engine can run.
 */
export type BootPlan = "npm" | "static" | "none";

/** Listens on 3000, one of the ports the E2B route already probes. */
export const STATIC_SERVE_COMMAND = "npx --yes serve@14 --no-clipboard --listen 3000";

export const NOTHING_TO_PREVIEW =
  "Add a package.json with a dev script, or an index.html, to preview this project.";

/** `paths` are project-relative, e.g. `package.json`, `src/main.ts`. */
export const bootPlan = (paths: string[], devCommand?: string): BootPlan => {
  if (devCommand || paths.includes("package.json")) return "npm";
  return paths.includes("index.html") ? "static" : "none";
};
