import { AI_PROVIDERS } from "../registry";
import { type PlatformProviderId, platformProviderId } from "../platform";
import { buildAgentKitModel } from "./agentkit-model";
import { buildAiSdkModel } from "./ai-sdk-model";

/**
 * Codenaya's own models, on the provider `NEXT_PUBLIC_AI_PROVIDER` picks
 * (ADR 0005). Server only: this is the one place that reads the platform keys.
 * They never reach the client, Convex, a step result or a log.
 *
 * Keys are read at call time, not module load, so importing this file never
 * fails when one is absent (that would break `next build`).
 */

/** The env var holding each provider's platform key. */
export const PLATFORM_KEY_ENV: Record<PlatformProviderId, string> = {
  openrouter: "OPENROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
};

/** Sent to the user when the platform has no key. The env var name is logged, not sent. */
export const AI_NOT_CONFIGURED_MESSAGE =
  "Codenaya AI isn't available right now. Try again later, or add your own key in Settings → AI providers.";

const readKey = (provider: PlatformProviderId) =>
  process.env[PLATFORM_KEY_ENV[provider]]?.trim() || undefined;

/** True when the active provider has a key. Lets callers refuse cleanly rather than throw. */
export function isPlatformConfigured(): boolean {
  const provider = platformProviderId();
  if (readKey(provider)) return true;
  console.error(
    `[ai-provider] ${PLATFORM_KEY_ENV[provider]} is not set, so platform AI ` +
      `(NEXT_PUBLIC_AI_PROVIDER=${provider}) is unavailable.`,
  );
  return false;
}

/** The active provider's key. Throws, naming the variable to set. */
export function readPlatformApiKey(provider = platformProviderId()): string {
  const apiKey = readKey(provider);
  if (!apiKey) {
    throw new Error(
      `${PLATFORM_KEY_ENV[provider]} is not configured. Add it to .env.local and ` +
        "to the deployment environment.",
    );
  }
  return apiKey;
}

/**
 * AgentKit model for an agent run.
 *
 * @param temperature Omitted for models that reject it — some reasoning models
 * error on a non-default temperature rather than ignoring it.
 */
export function platformAgentModel(model: string, temperature?: number) {
  const provider = platformProviderId();
  return buildAgentKitModel({
    provider,
    apiKey: readPlatformApiKey(provider),
    model,
    temperature,
  });
}

/** The provider's small model, for titles and editor AI. */
export const platformTitleModel = () => AI_PROVIDERS[platformProviderId()].titleModel!;

/**
 * AI SDK model for the editor AI routes. Editor tasks are short and
 * latency-sensitive, so they run on the provider's small model.
 */
export function platformEditorModel() {
  const provider = platformProviderId();
  return buildAiSdkModel({
    provider,
    apiKey: readPlatformApiKey(provider),
    model: platformTitleModel(),
  });
}
