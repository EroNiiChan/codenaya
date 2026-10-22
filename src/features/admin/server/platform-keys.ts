import type { PlatformProviderId } from "../platform-models";

/**
 * Where each platform provider's API key comes from. Server-only: the admin
 * UI gets the variable name and a configured flag, never the value.
 *
 * ponytail: stand-in until PR A (#402) merges; the wiring commit swaps it for
 * `PLATFORM_KEY_ENV` / `readPlatformApiKey` in `ai-providers/server/platform-model.ts`.
 */
export const PLATFORM_PROVIDERS: { id: PlatformProviderId; label: string; keyEnvVar: string }[] = [
  { id: "openrouter", label: "OpenRouter", keyEnvVar: "OPENROUTER_API_KEY" },
  { id: "openai", label: "OpenAI", keyEnvVar: "OPENAI_API_KEY" },
  { id: "anthropic", label: "Anthropic", keyEnvVar: "ANTHROPIC_API_KEY" },
  { id: "groq", label: "Groq", keyEnvVar: "GROQ_API_KEY" },
];

export const PLATFORM_PROVIDER_IDS = PLATFORM_PROVIDERS.map((p) => p.id) as [
  PlatformProviderId,
  ...PlatformProviderId[],
];

/** The provider's API key, or null when its variable isn't set. */
export const platformKeyOrNull = (provider: PlatformProviderId) =>
  process.env[PLATFORM_PROVIDERS.find((p) => p.id === provider)!.keyEnvVar]?.trim() || null;

/** The `NEXT_PUBLIC_AI_PROVIDER` fallback until PR A's `platformProviderId()` lands. */
export const ENV_PLATFORM_PROVIDER: PlatformProviderId = "openrouter";
