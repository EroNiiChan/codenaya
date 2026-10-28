import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { catalogModelValidator, platformProviderValidator } from "./schema";

/**
 * The platform model catalog (ADR 0010). Users read ids, names and flags;
 * routes and prices stay with the admin and the server. Writes come only from
 * `POST /api/admin/catalog`, which checks step-up auth and the provider keys
 * (only Next sees them), so `save` needs the admin's token and the internal key.
 *
 * CONTRACT STUBS: signatures are final; handlers are filled in by the backend
 * worker.
 */

const notImplemented = (name: string): never => {
  throw new Error(`platformCatalog.${name} is not implemented yet`);
};

const publicCatalogModelValidator = catalogModelValidator.pick(
  "id",
  "name",
  "vendor",
  "vision",
  "contextLength",
  "access",
);

const catalogFields = {
  models: v.array(catalogModelValidator),
  defaultModelId: v.string(),
  utilityModelId: v.string(),
};

/**
 * The catalog for users' pickers, hidden models left out, without routes or
 * prices. Null: no catalog saved, use the env provider's curated catalog.
 */
export const getForUsers = query({
  args: {},
  returns: v.union(
    v.object({ models: v.array(publicCatalogModelValidator), defaultModelId: v.string() }),
    v.null(),
  ),
  handler: async () => notImplemented("getForUsers"),
});

/** The full catalog for routes and agent runs: one read on the send path. */
export const getForServer = query({
  args: { internalKey: v.string() },
  returns: v.union(v.object(catalogFields), v.null()),
  handler: async () => notImplemented("getForServer"),
});

/** The full catalog for the /admin editor. */
export const getForAdmin = query({
  args: {},
  returns: v.union(
    v.object({ ...catalogFields, updatedAt: v.number(), updatedBy: v.string() }),
    v.null(),
  ),
  handler: async () => notImplemented("getForAdmin"),
});

/**
 * Replaces the catalog. Admin token AND internal key: the route has already
 * checked step-up auth and that every route's provider key is set. A $0 price
 * or a price change over 50% is refused unless `confirmRiskyPrices`. Writes a
 * structured audit row in the same transaction.
 */
export const save = mutation({
  args: {
    internalKey: v.string(),
    ...catalogFields,
    confirmRiskyPrices: v.boolean(),
    request: v.object({
      requestId: v.string(),
      ip: v.optional(v.string()),
      userAgent: v.optional(v.string()),
    }),
  },
  returns: v.null(),
  handler: async () => notImplemented("save"),
});

/**
 * One-off: builds the catalog from the deprecated per-provider config of the
 * active provider (`platformSettings`, else `fallbackProvider`). No-op when a
 * catalog exists. Run with `npx convex run platformCatalog:migrateFromProviderConfigs`.
 */
export const migrateFromProviderConfigs = internalMutation({
  args: {
    fallbackProvider: platformProviderValidator,
  },
  returns: v.string(),
  handler: async () => notImplemented("migrateFromProviderConfigs"),
});
