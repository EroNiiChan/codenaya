import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminOrNull } from "@/features/admin/server/require-admin";
import { PLATFORM_PROVIDER_IDS } from "@/features/ai-providers/platform";
import { PLATFORM_KEY_ENV, platformKeyOrNull } from "@/features/ai-providers/server/platform-model";
import { getAppError } from "@/lib/convex-error";
import { parseJsonBody } from "@/lib/parse-json-body";
import {
  ADMIN_PROVIDER_SWITCH_RATE_LIMIT,
  checkRateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";

import { api } from "../../../../../convex/_generated/api";

const requestSchema = z.object({ provider: z.enum(PLATFORM_PROVIDER_IDS) });

/**
 * POST /api/admin/provider: makes a provider the platform provider for every
 * user. Only this server can see which provider keys are set, so it refuses a
 * keyless provider here, then calls Convex as the admin (their own token, for
 * authz and the audit row) plus the internal key that proves the check ran.
 */
export async function POST(request: Request) {
  const admin = await adminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimit = checkRateLimit(admin.userId, ADMIN_PROVIDER_SWITCH_RATE_LIMIT);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

  const internalKey = process.env.CODENAYA_CONVEX_INTERNAL_KEY;
  if (!internalKey) {
    return NextResponse.json({ error: "Internal key not configured" }, { status: 500 });
  }

  const { data, invalid } = await parseJsonBody(request, requestSchema);
  if (invalid) return invalid;

  if (!platformKeyOrNull(data.provider)) {
    return NextResponse.json(
      {
        error: `${PLATFORM_KEY_ENV[data.provider]} is not set, so ${data.provider} can't run requests`,
        code: "ai_not_configured",
      },
      { status: 409 },
    );
  }

  try {
    await fetchMutation(
      api.platformModels.setActiveProvider,
      { internalKey, provider: data.provider },
      { token: admin.token },
    );
  } catch (error) {
    const appError = getAppError(error);
    // Admin rights lost between the check above and the mutation: same 404.
    if (appError?.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (appError?.code !== "CONFLICT") throw error;
    return NextResponse.json({ error: appError.message, code: "no_models" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
