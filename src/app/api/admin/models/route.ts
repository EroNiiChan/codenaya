import { NextResponse } from "next/server";

import {
  ProviderModelsError,
  fetchProviderModels,
} from "@/features/admin/server/fetch-provider-models";
import { adminUserIdOrNull } from "@/features/admin/server/require-admin";
import { isOpenRouterConfigured, readOpenRouterApiKey } from "@/lib/openrouter";
import {
  ADMIN_MODELS_FETCH_RATE_LIMIT,
  checkRateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";

/**
 * GET /api/admin/models: the active platform provider's models, live, for the
 * /admin picker. Admin only; anyone else gets the same 404 as a missing route.
 * Returns normalized rows only: the key and the upstream body never leave.
 */
export async function GET() {
  const userId = await adminUserIdOrNull();
  if (!userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimit = checkRateLimit(userId, ADMIN_MODELS_FETCH_RATE_LIMIT);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

  const provider = "openrouter";
  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not configured", code: "ai_not_configured" },
      { status: 503 },
    );
  }

  try {
    const models = await fetchProviderModels(provider, readOpenRouterApiKey());
    return NextResponse.json({ provider, models });
  } catch (error) {
    if (!(error instanceof ProviderModelsError)) throw error;
    return NextResponse.json(
      { error: "The provider's model list is unavailable", code: "provider_error", status: error.status },
      { status: 502 },
    );
  }
}
