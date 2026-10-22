import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { type Infer, v } from "convex/values";

import { MAX_PLATFORM_MODELS, MAX_USD_PER_MTOK } from "../src/features/admin/platform-models";
import { MAX_MODEL_ID_LENGTH } from "../src/features/ai-providers/registry";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin, writeAudit } from "./admin";
import { verifyAuth } from "./auth";
import { appError } from "./errors";
import { validateInternalKey } from "./internalKey";
import { platformModelValidator, platformProviderValidator } from "./schema";

/**
 * The admin's selection of platform models per provider (/admin). Users see
 * ids, names and flags; prices stay with the admin and the server.
 */

const MAX_NAME_LENGTH = 120;
const MAX_VENDOR_LENGTH = 60;
/** A long diff is cut; the full state is in the config doc itself. */
const MAX_SUMMARY_LENGTH = 1000;

type PlatformModel = Infer<typeof platformModelValidator>;
type Provider = Infer<typeof platformProviderValidator>;

const getConfig = (ctx: QueryCtx, provider: Provider) =>
  ctx.db
    .query("platformModelConfigs")
    .withIndex("by_provider", (q) => q.eq("provider", provider))
    .unique();

const invalid = (message: string) => appError("INVALID_ARGUMENT", message);

const isPrice = (n: number) => Number.isFinite(n) && n >= 0 && n <= MAX_USD_PER_MTOK;

function assertValidSelection(models: PlatformModel[], defaultModelId: string) {
  if (models.length === 0 || models.length > MAX_PLATFORM_MODELS) {
    throw invalid(`Select between 1 and ${MAX_PLATFORM_MODELS} models`);
  }
  const ids = new Set<string>();
  for (const model of models) {
    if (!model.id || model.id.length > MAX_MODEL_ID_LENGTH) throw invalid("Invalid model id");
    if (ids.has(model.id)) throw invalid(`Duplicate model ${model.id}`);
    ids.add(model.id);
    if (!model.name.trim() || model.name.length > MAX_NAME_LENGTH) {
      throw invalid(`Invalid name for ${model.id}`);
    }
    if (model.vendor.length > MAX_VENDOR_LENGTH) throw invalid(`Invalid vendor for ${model.id}`);
    if (
      model.contextLength !== undefined &&
      !(Number.isInteger(model.contextLength) && model.contextLength > 0)
    ) {
      throw invalid(`Invalid context length for ${model.id}`);
    }
    if (!isPrice(model.inputUsdPerMTok) || !isPrice(model.outputUsdPerMTok)) {
      throw invalid(`Prices for ${model.id} must be between $0 and $${MAX_USD_PER_MTOK} per 1M tokens`);
    }
  }
  if (!ids.has(defaultModelId)) throw invalid("The default model must be one of the selected models");
}

const price = (m: PlatformModel) => `$${m.inputUsdPerMTok}/$${m.outputUsdPerMTok}`;

/** "added a, b; removed c; default → x; price a: $3/$15; tools confirmed: b". */
function summarizeChange(
  before: Pick<Doc<"platformModelConfigs">, "models" | "defaultModelId"> | null,
  models: PlatformModel[],
  defaultModelId: string,
): string {
  const old = new Map((before?.models ?? []).map((m) => [m.id, m]));
  const now = new Set(models.map((m) => m.id));
  const added = models.filter((m) => !old.has(m.id));
  const removed = [...old.keys()].filter((id) => !now.has(id));
  const repriced = models.filter((m) => old.has(m.id) && price(old.get(m.id)!) !== price(m));
  const confirmed = models.filter(
    (m) => m.tools === "confirmed" && old.get(m.id)?.tools !== "confirmed",
  );

  const parts: string[] = [];
  if (added.length) parts.push(`added ${added.map((m) => `${m.id} (${price(m)})`).join(", ")}`);
  if (removed.length) parts.push(`removed ${removed.join(", ")}`);
  if (before?.defaultModelId !== defaultModelId) parts.push(`default → ${defaultModelId}`);
  for (const m of repriced) parts.push(`price ${m.id}: ${price(old.get(m.id)!)} → ${price(m)}`);
  if (confirmed.length) {
    parts.push(`tools confirmed by admin: ${confirmed.map((m) => m.id).join(", ")}`);
  }
  const summary = parts.join("; ") || "no changes";
  return summary.length > MAX_SUMMARY_LENGTH
    ? `${summary.slice(0, MAX_SUMMARY_LENGTH - 1)}…`
    : summary;
}

const publicModelValidator = platformModelValidator.pick("id", "name", "vendor", "vision", "contextLength");

/** The models users may pick on the platform key, without prices. Null: use the catalog. */
export const list = query({
  args: { provider: platformProviderValidator },
  returns: v.union(
    v.object({ models: v.array(publicModelValidator), defaultModelId: v.string() }),
    v.null(),
  ),
  handler: async (ctx, { provider }) => {
    await verifyAuth(ctx);
    const config = await getConfig(ctx, provider);
    if (!config) return null;
    return {
      models: config.models.map(({ id, name, vendor, vision, contextLength }) => ({
        id,
        name,
        vendor,
        vision,
        contextLength,
      })),
      defaultModelId: config.defaultModelId,
    };
  },
});

const configValidator = v.object({
  models: v.array(platformModelValidator),
  defaultModelId: v.string(),
});

const toConfig = (doc: Doc<"platformModelConfigs"> | null) =>
  doc && { models: doc.models, defaultModelId: doc.defaultModelId };

/** The full saved selection, prices included, for the /admin editor. */
export const getForAdmin = query({
  args: { provider: platformProviderValidator },
  returns: v.union(configValidator, v.null()),
  handler: async (ctx, { provider }) => {
    await requireAdmin(ctx);
    return toConfig(await getConfig(ctx, provider));
  },
});

/** The full saved selection for the routes and the agent run. */
export const getForServer = query({
  args: { internalKey: v.string(), provider: platformProviderValidator },
  returns: v.union(configValidator, v.null()),
  handler: async (ctx, { internalKey, provider }) => {
    validateInternalKey(internalKey);
    return toConfig(await getConfig(ctx, provider));
  },
});

/** Replaces the provider's selection and audits the change, in one transaction. */
export const save = mutation({
  args: {
    provider: platformProviderValidator,
    models: v.array(platformModelValidator),
    defaultModelId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { provider, models, defaultModelId }) => {
    const admin = await requireAdmin(ctx);
    assertValidSelection(models, defaultModelId);

    const existing = await getConfig(ctx, provider);
    const fields = { models, defaultModelId, updatedAt: Date.now(), updatedBy: admin.id };
    if (existing) {
      await ctx.db.patch("platformModelConfigs", existing._id, fields);
    } else {
      await ctx.db.insert("platformModelConfigs", { provider, ...fields });
    }

    await writeAudit(
      ctx,
      admin,
      "platformModels.save",
      `${provider}: ${summarizeChange(existing, models, defaultModelId)}`,
    );
    return null;
  },
});

/** The audit log, newest first. */
export const listAudit = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      _id: v.id("adminAuditLog"),
      _creationTime: v.number(),
      actorId: v.string(),
      actorEmail: v.string(),
      action: v.string(),
      summary: v.string(),
      at: v.number(),
    }),
  ),
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("adminAuditLog")
      .withIndex("by_at")
      .order("desc")
      .paginate(paginationOpts);
  },
});
