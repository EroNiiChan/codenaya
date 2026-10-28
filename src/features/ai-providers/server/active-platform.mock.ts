import { getFunctionName } from "convex/server";

/**
 * For tests that stub `convex.query`: answers the catalog read
 * (`platformCatalog`) with null, so runs use the env provider's curated
 * catalog as before the admin saves one, unless `saved` returns a catalog.
 * Every other query goes to `query`, so existing call orders and expectations stay.
 */
export const withEnvPlatform =
  (query: (...args: never[]) => unknown, saved?: () => unknown) =>
  async (ref: Parameters<typeof getFunctionName>[0], args: unknown) =>
    getFunctionName(ref) === "platformCatalog:getForServer"
      ? (saved?.() ?? null)
      : (query as (ref: unknown, args: unknown) => unknown)(ref, args);
