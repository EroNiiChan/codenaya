import { MAX_MODEL_ID_LENGTH } from "../../ai-providers/registry";
import type { FetchedModel, PlatformProviderId } from "../platform-models";

/**
 * Lists the models the platform key can use, live from the provider, for the
 * /admin picker. The provider JSON is untrusted: every row is narrowed, bounded
 * and normalized here, and malformed rows are dropped.
 *
 * OpenAI and Groq don't report tool calling or vision, so the admin confirms
 * tool calling by hand there.
 */

/** Bounds the response; OpenRouter lists ~350 today. */
export const MAX_FETCHED_MODELS = 1000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_NAME_LENGTH = 120;
const MAX_VENDOR_LENGTH = 60;

/** The provider answered with an error, timed out or sent something unreadable. */
export class ProviderModelsError extends Error {
  constructor(readonly status: number | null) {
    super(`Provider model list failed${status ? ` (${status})` : ""}`);
  }
}

type Row = Record<string, unknown>;

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const posInt = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** OpenRouter prices are USD-per-token strings; "-1" marks variable pricing. */
const perMTok = (value: unknown) => {
  const perToken = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  if (!Number.isFinite(perToken) || perToken < 0) return undefined;
  // Round off float noise from ×1e6 (0.000003 × 1e6 = 2.9999999999999996).
  return Number((perToken * 1e6).toFixed(6));
};

const OPENAI_NON_CHAT =
  /embed|tts|whisper|dall-e|image|moderation|transcribe|audio|realtime|search|sora|davinci|babbage/i;
const GROQ_NON_CHAT = /whisper|tts|guard|orpheus|playai/i;

const normalizers: Record<PlatformProviderId, (row: Row) => Omit<FetchedModel, "id"> | null> = {
  openrouter: (row) => {
    const architecture = (row.architecture ?? {}) as Row;
    const pricing = (row.pricing ?? {}) as Row;
    return {
      name: str(row.name) || str(row.id),
      vendor: str(row.id).split("/")[0],
      contextLength: posInt(row.context_length),
      vision: strings(architecture.input_modalities).includes("image"),
      tools: strings(row.supported_parameters).includes("tools"),
      inputUsdPerMTok: perMTok(pricing.prompt),
      outputUsdPerMTok: perMTok(pricing.completion),
    };
  },
  openai: (row) =>
    OPENAI_NON_CHAT.test(str(row.id))
      ? null
      : { name: str(row.id), vendor: "openai", vision: null, tools: null },
  // Every Messages-API model can call tools. Vision is forced off: AgentKit's
  // Anthropic adapter forwards only text, so images could never reach it.
  anthropic: (row) => ({
    name: str(row.display_name) || str(row.id),
    vendor: "anthropic",
    contextLength: posInt(row.max_input_tokens),
    vision: false,
    tools: true,
  }),
  groq: (row) =>
    row.active === false || GROQ_NON_CHAT.test(str(row.id))
      ? null
      : {
          name: str(row.id),
          vendor: str(row.owned_by).toLowerCase() || "groq",
          contextLength: posInt(row.context_window),
          vision: null,
          tools: null,
        },
};

/** Normalizes a provider's `/models` JSON. Exported for fixture tests. */
export function normalizeProviderModels(provider: PlatformProviderId, body: unknown): FetchedModel[] {
  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new ProviderModelsError(null);

  const models: FetchedModel[] = [];
  const seen = new Set<string>();
  for (const row of data) {
    if (models.length >= MAX_FETCHED_MODELS) break;
    if (typeof row !== "object" || row === null) continue;
    const id = str((row as Row).id);
    if (!id || id.length > MAX_MODEL_ID_LENGTH || seen.has(id)) continue;
    const model = normalizers[provider](row as Row);
    if (!model) continue;
    seen.add(id);
    models.push({
      ...model,
      id,
      name: model.name.slice(0, MAX_NAME_LENGTH),
      vendor: model.vendor.slice(0, MAX_VENDOR_LENGTH),
    });
  }
  return models;
}

const requests: Record<PlatformProviderId, (apiKey: string) => [string, HeadersInit]> = {
  openrouter: (key) => ["https://openrouter.ai/api/v1/models", { Authorization: `Bearer ${key}` }],
  openai: (key) => ["https://api.openai.com/v1/models", { Authorization: `Bearer ${key}` }],
  anthropic: (key) => [
    "https://api.anthropic.com/v1/models?limit=1000",
    { "x-api-key": key, "anthropic-version": "2023-06-01" },
  ],
  groq: (key) => ["https://api.groq.com/openai/v1/models", { Authorization: `Bearer ${key}` }],
};

/** The provider's models, normalized. Throws `ProviderModelsError`; never echoes the body. */
export async function fetchProviderModels(
  provider: PlatformProviderId,
  apiKey: string,
): Promise<FetchedModel[]> {
  const [url, headers] = requests[provider](apiKey);
  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    // Network failure or timeout. The cause can include the URL, never the key.
    throw new ProviderModelsError(null);
  }
  if (!response.ok) throw new ProviderModelsError(response.status);
  const body: unknown = await response.json().catch(() => null);
  return normalizeProviderModels(provider, body);
}
