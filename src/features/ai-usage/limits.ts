import { CREDIT_VALUE_USD, PLANS, type PlanId } from "../billing/plans";

/**
 * Monthly usage limits for Codenaya's own AI (platform key only; BYOK never
 * counts). Pure, so Convex enforces the same math the UI shows.
 *
 * Money is integer micro-USD (1 µUSD = $0.000001), so totals never drift.
 * Prices are USD per 1M tokens, which makes `tokens × $/MTok` exactly µUSD.
 */

export const MICRO_USD_PER_USD = 1_000_000;

/** Upper bounds the admin can set; also what `setPlanLimits` validates. */
export const MAX_MONTHLY_USD_LIMIT = 10_000;
export const MAX_MONTHLY_TOKEN_LIMIT = 1_000_000_000;

/** Tokens one model call may record; a larger number is a bug, not usage. */
export const MAX_TOKENS_PER_CALL = 10_000_000;

/** A plan's caps. `undefined` means no cap of that kind. */
export interface PlanLimits {
  costLimitMicroUsd?: number;
  tokenLimit?: number;
}

/** What a user has used this month against their plan's caps. */
export interface UsageStatus extends PlanLimits {
  planId: PlanId;
  costMicroUsd: number;
  tokens: number;
  exceeded: boolean;
  /** Which cap blocked; the USD cap wins when both are reached. */
  exceededBy?: "usd" | "tokens";
}

/** The UTC month usage is counted in, "YYYY-MM". */
export const monthKey = (now: number = Date.now()) => new Date(now).toISOString().slice(0, 7);

/** Cost of one call. Cached-input discounts are ignored: it overestimates, the safe side. */
export const costMicroUsd = (
  inputTokens: number,
  outputTokens: number,
  price: { inputUsdPerMTok: number; outputUsdPerMTok: number },
) => Math.round(inputTokens * price.inputUsdPerMTok + outputTokens * price.outputUsdPerMTok);

export const usdToMicro = (usd: number) => Math.round(usd * MICRO_USD_PER_USD);

/** The caps before the admin saves any: the plan's monthly credits, no token cap. */
export const defaultPlanLimits = (planId: PlanId): PlanLimits => ({
  costLimitMicroUsd: usdToMicro(PLANS[planId].monthlyCredits * CREDIT_VALUE_USD),
});

/** Blocked once either cap is reached; reaching a cap exactly counts. */
export function usageStatus(
  planId: PlanId,
  limits: PlanLimits,
  usage: { costMicroUsd: number; tokens: number },
): UsageStatus {
  const overUsd = limits.costLimitMicroUsd !== undefined && usage.costMicroUsd >= limits.costLimitMicroUsd;
  const overTokens = limits.tokenLimit !== undefined && usage.tokens >= limits.tokenLimit;
  return {
    planId,
    ...limits,
    ...usage,
    exceeded: overUsd || overTokens,
    ...(overUsd ? { exceededBy: "usd" as const } : overTokens ? { exceededBy: "tokens" as const } : {}),
  };
}

/** "$3.00"; sub-cent amounts keep their digits ("$0.0012"). */
export const formatUsd = (micro: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: micro > 0 && micro < 10_000 ? 6 : 2,
  }).format(micro / MICRO_USD_PER_USD);

export const formatTokens = (tokens: number) => tokens.toLocaleString("en-US");

/** First day of the next UTC month, e.g. "November 1". */
export const resetDate = (month: string) => {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m, 1)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
};

/** The reply when a cap blocks platform AI: which cap, the plan, when it resets, the way out. */
export function usageLimitMessage(status: UsageStatus, month: string): string {
  const plan = PLANS[status.planId].name;
  const monthName = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  const used =
    status.exceededBy === "tokens"
      ? `${formatTokens(status.tokenLimit ?? 0)} tokens`
      : formatUsd(status.costLimitMicroUsd ?? 0);
  return (
    `You've used your ${plan} plan's ${used} of Codenaya AI for ${monthName}. ` +
    `It resets on ${resetDate(month)}. Add your own API key in Settings → AI providers to keep going.`
  );
}

/** The error code routes answer a blocked platform request with (402). */
export const USAGE_LIMIT_CODE = "usage_limit";
