import ky, { HTTPError } from "ky";
import { useMutation, useQuery } from "convex/react";

import { usePromoActive, usePromoClaim } from "@/features/promotions/hooks/use-promo";

import {
  type ActivePlatform,
  platformConfigFrom,
  platformProviderId,
  promoOnlyModels,
} from "../platform";
import type { AiProviderId } from "../registry";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

/**
 * Bindings for the AI providers settings tab. Keys are listed and deleted in
 * Convex, but created and tested through `/api/ai-providers`, which holds the
 * KEK and talks to the provider. Nothing here ever receives key material.
 */

/** The signed-in user's keys, newest first, as browser-safe summaries. */
export const useAiProviderKeys = () => useQuery(api.aiProviders.list);

/**
 * The platform provider and the models users may pick on it: the admin's
 * selection in /admin, live (a removed model leaves open pickers at once),
 * else the env provider's catalog. Undefined while loading.
 */
export const usePlatformModels = (): ActivePlatform | undefined => {
  const active = useQuery(api.platformModels.getActive, { fallbackProvider: platformProviderId() });
  return active && { provider: active.provider, config: platformConfigFrom(active.config) };
};

/** `usePlatformModels`, showing the env provider's catalog until it loads. */
export const usePlatformModelsOrCatalog = (): ActivePlatform =>
  usePlatformModels() ?? { provider: platformProviderId(), config: null };

/**
 * The promotion's models the user may pick on top of the platform's (ADR
 * 0009): only with a claim, while the promotion runs. Empty while loading.
 */
export const usePromoModels = (platform: ActivePlatform | undefined) => {
  const claim = usePromoClaim();
  const active = usePromoActive();
  if (!platform || !claim || !active) return [];
  return promoOnlyModels(platform.provider, platform.config);
};

export const useRemoveAiProviderKey = () => useMutation(api.aiProviders.remove);

/** The default model; no `defaultKeyId` means the Codenaya platform key. */
export const useAiPreferences = () => useQuery(api.aiProviders.getPreferences);

export const useSetAiPreferences = () =>
  useMutation(api.aiProviders.setPreferences);

export interface AddAiProviderKeyInput {
  provider: AiProviderId;
  apiKey: string;
  label?: string;
  baseUrl?: string;
  modelIds?: string[];
}

/** Tests the key with the provider, then stores it sealed. */
export const addAiProviderKey = (input: AddAiProviderKeyInput) =>
  ky.post("/api/ai-providers", { json: input, timeout: 30_000 }).json();

/** Re-tests a stored key; the route records the outcome on the key. */
export const testAiProviderKey = (keyId: Id<"aiProviderKeys">) =>
  ky.post(`/api/ai-providers/${keyId}/test`, { timeout: 30_000 }).json();

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/**
 * The message to show for a failed `/api/ai-providers` call. The routes write
 * errors for users (rejected key, unsafe URL, rate limit) and never echo the
 * key, so their text is shown as is.
 */
export const aiProviderRequestError = async (error: unknown) => {
  if (error instanceof HTTPError) {
    const body = await error.response
      .json<{ error?: string }>()
      .catch(() => ({ error: undefined }));
    return body.error ?? FALLBACK_MESSAGE;
  }
  return FALLBACK_MESSAGE;
};
