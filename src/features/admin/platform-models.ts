import { blendedUsdPerMTok, type CatalogModel } from "../ai-providers/catalog";
import type { PlatformProviderId } from "../ai-providers/platform";

/**
 * Limits and shapes of the admin's platform model catalog. Pure, so /admin
 * validates with the same numbers and rules `convex/platformCatalog.ts` enforces.
 */

export type { PlatformProviderId };

/** Bounds the config doc (about 15 KB) and the users' picker. */
export const MAX_PLATFORM_MODELS = 50;

/** Bounds on a model's display strings, from the provider or the admin. */
export const MAX_MODEL_NAME_LENGTH = 120;
export const MAX_MODEL_VENDOR_LENGTH = 60;

/** USD per 1M tokens. Far above any real price; catches a per-token value pasted ×1e6. */
export const MAX_USD_PER_MTOK = 1000;

/** A blended price moving more than this fraction from the saved one needs confirming. */
export const RISKY_PRICE_CHANGE_RATIO = 0.5;

/**
 * Ids of the models whose price needs `confirmRiskyPrices` (ADR 0010): a new
 * or changed $0 blended price, or one more than `RISKY_PRICE_CHANGE_RATIO`
 * away from the saved price of the same id. An unchanged price never asks
 * again, so free models don't prompt on every save.
 */
export const riskyPriceModelIds = (
  saved: readonly Pick<CatalogModel, "id" | "pricing">[],
  models: readonly Pick<CatalogModel, "id" | "pricing">[],
): string[] => {
  const savedPrices = new Map(saved.map((m) => [m.id, blendedUsdPerMTok(m.pricing)]));
  return models
    .filter((model) => {
      const price = blendedUsdPerMTok(model.pricing);
      const before = savedPrices.get(model.id);
      if (price === before) return false;
      return (
        price === 0 ||
        (before !== undefined && Math.abs(price - before) > RISKY_PRICE_CHANGE_RATIO * before)
      );
    })
    .map((model) => model.id);
};

/**
 * A model as `GET /api/admin/models` returns it. `tools` and `vision` are null
 * when the provider's API doesn't say; prices only come from OpenRouter.
 */
export interface FetchedModel {
  id: string;
  name: string;
  vendor: string;
  contextLength?: number;
  vision: boolean | null;
  tools: boolean | null;
  inputUsdPerMTok?: number;
  outputUsdPerMTok?: number;
}
