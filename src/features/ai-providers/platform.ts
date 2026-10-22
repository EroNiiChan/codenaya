import { AI_PROVIDERS, type ProviderModel } from "./registry";

/**
 * The Codenaya platform provider: which provider runs users' requests when
 * they have no key of their own, and which of its models they may pick.
 *
 * The admin picks it in /admin (ADR 0006); `NEXT_PUBLIC_AI_PROVIDER` is the
 * fallback until they do (ADR 0005). Public on purpose: it holds
 * no secret, and the client needs it to list the right models. Client-safe;
 * the provider keys are read only in `server/platform-model.ts`.
 */

export const PLATFORM_PROVIDER_IDS = ["openrouter", "openai", "anthropic", "groq"] as const;

export type PlatformProviderId = (typeof PLATFORM_PROVIDER_IDS)[number];

/** Today's behaviour, used when the env is unset or invalid. */
export const DEFAULT_PLATFORM_PROVIDER: PlatformProviderId = "openrouter";

/** An admin's model selection for a provider (/admin); `null` means the catalog. */
export interface PlatformModelConfig {
  models: readonly ProviderModel[];
  defaultModelId: string;
}

/** A selection as Convex stores it, in the resolver's shape. */
export const platformConfigFrom = (
  saved: {
    models: readonly { id: string; name: string; vendor: string; vision: boolean }[];
    defaultModelId: string;
  } | null,
): PlatformModelConfig | null =>
  saved && {
    models: saved.models.map(({ id, name, vendor, vision }) => ({ id, label: name, vendor, vision })),
    defaultModelId: saved.defaultModelId,
  };

let warnedInvalid = false;

/**
 * The env's platform provider: the fallback until the admin picks one in
 * /admin. An invalid value falls back to the default, once logged.
 */
export function platformProviderId(): PlatformProviderId {
  // Read as a literal so Next inlines it into the client bundle.
  const value = process.env.NEXT_PUBLIC_AI_PROVIDER?.trim().toLowerCase();
  if (!value) return DEFAULT_PLATFORM_PROVIDER;
  if ((PLATFORM_PROVIDER_IDS as readonly string[]).includes(value)) {
    return value as PlatformProviderId;
  }
  if (!warnedInvalid) {
    warnedInvalid = true;
    console.warn(
      `[ai-provider] NEXT_PUBLIC_AI_PROVIDER="${value}" is not one of ` +
        `${PLATFORM_PROVIDER_IDS.join(", ")}. Using ${DEFAULT_PLATFORM_PROVIDER}.`,
    );
  }
  return DEFAULT_PLATFORM_PROVIDER;
}

/** The models users may pick: the admin's selection, else the curated catalog. */
export function platformModels(
  provider: PlatformProviderId,
  config: PlatformModelConfig | null,
): readonly ProviderModel[] {
  return config?.models ?? AI_PROVIDERS[provider].models;
}

/**
 * The model a platform run uses: the requested one if it is listed, else the
 * configured default, else the catalog default. An unknown, removed or
 * other-provider id never runs, so a crafted request can't pick its model.
 */
export function resolvePlatformModel(
  provider: PlatformProviderId,
  config: PlatformModelConfig | null,
  requestedId: string | undefined,
): ProviderModel {
  const models = platformModels(provider, config);
  const find = (id: string | undefined) => models.find((model) => model.id === id);
  return (
    find(requestedId) ??
    find(config?.defaultModelId) ??
    find(AI_PROVIDERS[provider].defaultModel) ??
    // Never empty: catalogs are curated and a saved selection has at least one model.
    models[0]!
  );
}
