import type { Infer } from "convex/values";

import type { platformProviderValidator } from "../../../convex/schema";

/**
 * Limits and shapes of the admin's platform model selection. Pure, so /admin
 * validates with the same numbers `convex/platformModels.ts` enforces.
 */

export type PlatformProviderId = Infer<typeof platformProviderValidator>;

/** Bounds the config doc (about 15 KB) and the users' picker. */
export const MAX_PLATFORM_MODELS = 50;

/** Bounds on a model's display strings, from the provider or the admin. */
export const MAX_MODEL_NAME_LENGTH = 120;
export const MAX_MODEL_VENDOR_LENGTH = 60;

/** USD per 1M tokens. Far above any real price; catches a per-token value pasted ×1e6. */
export const MAX_USD_PER_MTOK = 1000;

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
