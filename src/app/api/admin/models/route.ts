import { NextResponse } from "next/server";

import {
  ProviderModelsError,
  fetchProviderModels,
} from "@/features/admin/server/fetch-provider-models";
import {
  PLATFORM_PROVIDERS,
  platformKeyOrNull,
} from "@/features/admin/server/platform-keys";
import { adminOrNull } from "@/features/admin/server/require-admin";
import {
  ADMIN_MODELS_FETCH_RATE_LIMIT,
  checkRateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";

/**
 * GET /api/admin/models?provider=<id>: a platform provider's models, live,
 * for the /admin picker. Any provider can be fetched, so the admin can set up
 * one before making it active. Admin only; anyone else gets the same 404 as a
 * missing route. Returns normalized rows only: the key and the upstream body
 * never leave.
 */
export async function GET(request: Request) {
  const admin = await adminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimit = checkRateLimit(admin.userId, ADMIN_MODELS_FETCH_RATE_LIMIT);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

  const id = new URL(request.url).searchParams.get("provider");
  const provider = PLATFORM_PROVIDERS.find((p) => p.id === id);
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const apiKey = platformKeyOrNull(provider.id);
  if (!apiKey) {
    return NextResponse.json(
      { error: `${provider.keyEnvVar} is not configured`, code: "ai_not_configured" },
      { status: 503 },
    );
  }

  try {
    const models = await fetchProviderModels(provider.id, apiKey);
    return NextResponse.json({ provider: provider.id, models });
  } catch (error) {
    if (!(error instanceof ProviderModelsError)) throw error;
    return NextResponse.json(
      { error: "The provider's model list is unavailable", code: "provider_error", status: error.status },
      { status: 502 },
    );
  }
}
