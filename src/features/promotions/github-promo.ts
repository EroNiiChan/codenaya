/**
 * The GitHub launch promotion (ADR 0009): a GitHub account at least a year old
 * claims, once, 20 Claude Opus 5.5 runs and unlimited Claude Sonnet 5.5 until
 * the promotion ends.
 *
 * Pure on purpose: Convex enforces these numbers, the routes and the agent run
 * check them, and the page and picker render them from the same constants.
 * No imports from `ai-providers`, which depends on this module.
 */

/** Exclusive end: Nov 1 2026 00:00 UTC. Claims and promo runs stop here. */
export const PROMO_ENDS_AT = Date.UTC(2026, 10, 1);

/** The GitHub account must be at least this old when it claims. */
export const MIN_GITHUB_ACCOUNT_AGE_DAYS = 365;

/** Opus runs each claim includes. Sonnet runs are not counted. */
export const PROMO_OPUS_RUN_LIMIT = 20;

export const PROMO_PATH = "/promo";

export type PromoModelKind = "opus" | "sonnet";

export interface PromoModel {
  id: string;
  label: string;
  vendor: string;
  vision: boolean;
  kind: PromoModelKind;
}

/**
 * The promo models on each platform provider that serves Claude. Groq and
 * OpenAI don't, so the promotion has no models there. Vision follows the
 * provider catalogs: AgentKit's Anthropic adapter forwards text only.
 */
const PROMO_MODELS: Partial<Record<string, readonly PromoModel[]>> = {
  openrouter: [
    { id: "anthropic/claude-opus-5.5", label: "Claude Opus 5.5", vendor: "Anthropic", vision: true, kind: "opus" },
    { id: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5", vendor: "Anthropic", vision: true, kind: "sonnet" },
  ],
  anthropic: [
    { id: "claude-opus-5-5", label: "Claude Opus 5.5", vendor: "Anthropic", vision: false, kind: "opus" },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", vendor: "Anthropic", vision: false, kind: "sonnet" },
  ],
};

export const promoModelsFor = (provider: string): readonly PromoModel[] =>
  PROMO_MODELS[provider] ?? [];

/** Whether `modelId` is a promo model on any provider: a check before any read. */
export const isPromoModelId = (modelId: string) =>
  Object.values(PROMO_MODELS).some((models) => models?.some((model) => model.id === modelId));

export const isPromoActive = (now: number) => now < PROMO_ENDS_AT;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether a GitHub account created at `createdAt` is old enough at `now`. */
export const isGithubAccountOldEnough = (createdAt: number, now: number) =>
  now - createdAt >= MIN_GITHUB_ACCOUNT_AGE_DAYS * DAY_MS;

/** A claim as the promotion reads it. */
export interface PromoClaimState {
  opusRunsUsed: number;
}

export const opusRunsLeft = (claim: PromoClaimState) =>
  Math.max(0, PROMO_OPUS_RUN_LIMIT - claim.opusRunsUsed);

/**
 * Why a claimant can't run `model` now, or null when they can. A missing claim
 * is the caller's case to word: the picker never lists promo models without one.
 */
export type PromoRunRefusal = "ended" | "opus_used_up";

export const promoRunRefusal = (
  claim: PromoClaimState,
  model: Pick<PromoModel, "kind">,
  now: number,
): PromoRunRefusal | null => {
  if (!isPromoActive(now)) return "ended";
  if (model.kind === "opus" && opusRunsLeft(claim) === 0) return "opus_used_up";
  return null;
};

export const PROMO_REFUSAL_MESSAGES: Record<PromoRunRefusal | "not_claimed", string> = {
  not_claimed: `Claim the free Claude promotion at ${PROMO_PATH} to use this model.`,
  ended: "The free Claude promotion has ended. Pick another model to continue.",
  opus_used_up: `You've used all ${PROMO_OPUS_RUN_LIMIT} free Opus 5.5 runs. Claude Sonnet 5.5 is still free until the promotion ends.`,
};

/** The `code` a send route answers when a promo model can't run. */
export const isPromoRefusalCode = (code: string | undefined) =>
  code !== undefined && code.startsWith("promo_");

/** Why `POST /api/promotions/claim` refused; the page branches on these. */
export type PromoClaimErrorCode =
  | "github_not_linked"
  | "github_too_new"
  | "github_already_used"
  | "already_claimed"
  | "promo_ended";

export const PROMO_CLAIM_ERROR_MESSAGES: Record<PromoClaimErrorCode, string> = {
  github_not_linked: "Connect your GitHub account to claim.",
  github_too_new: `This promotion is for GitHub accounts at least ${MIN_GITHUB_ACCOUNT_AGE_DAYS} days old.`,
  github_already_used: "This GitHub account was already used to claim the promotion.",
  already_claimed: "You've already claimed the promotion.",
  promo_ended: "The promotion has ended.",
};

/** The end, as the page and banner say it. */
export const PROMO_ENDS_LABEL = "Nov 1, 00:00 UTC";
