import { NextResponse } from "next/server";

import {
  ProviderModelsError,
  fetchProviderModels,
} from "@/features/admin/server/fetch-provider-models";
import { adminOrNull } from "@/features/admin/server/require-admin";
import { PLATFORM_PROVIDER_IDS, type PlatformProviderId } from "@/features/ai-providers/platform";
import { PLATFORM_KEY_ENV, platformKeyOrNull } from "@/features/ai-providers/server/platform-model";
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

  const provider = new URL(request.url).searchParams.get("provider") as PlatformProviderId;
  if (!PLATFORM_PROVIDER_IDS.includes(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const apiKey = platformKeyOrNull(provider);
  if (!apiKey) {
    return NextResponse.json(
      { error: `${PLATFORM_KEY_ENV[provider]} is not configured`, code: "ai_not_configured" },
      { status: 503 },
    );
  }

  try {
    const models = await fetchProviderModels(provider, apiKey);
    return NextResponse.json({ provider, models });
  } catch (error) {
    if (!(error instanceof ProviderModelsError)) throw error;
    return NextResponse.json(
      { error: "The provider's model list is unavailable", code: "provider_error", status: error.status },
      { status: 502 },
    );
  }
}
