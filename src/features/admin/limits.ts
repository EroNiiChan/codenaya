/**
 * Limits on the admin's platform model selection. Pure, so /admin validates
 * with the same numbers `convex/platformModels.ts` enforces.
 */

/** Bounds the config doc (about 15 KB) and the users' picker. */
export const MAX_PLATFORM_MODELS = 50;

/** USD per 1M tokens. Far above any real price; catches a per-token value pasted ×1e6. */
export const MAX_USD_PER_MTOK = 1000;
