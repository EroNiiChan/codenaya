import { getFunctionName } from "convex/server";

/**
 * For tests that stub `convex.query`: answers the active-platform read
 * (`activePlatform`) with the env provider and its catalog, as before the
 * admin saves anything, unless `saved` returns an admin selection. Every other
 * query goes to `query`, so existing call orders and expectations stay.
 */
export const withEnvPlatform =
  (query: (...args: never[]) => unknown, saved?: () => unknown) =>
  async (ref: Parameters<typeof getFunctionName>[0], args: { fallbackProvider?: string }) =>
    getFunctionName(ref) === "platformModels:getActiveForServer"
      ? (saved?.() ?? { provider: args.fallbackProvider, config: null })
      : (query as (ref: unknown, args: unknown) => unknown)(ref, args);
