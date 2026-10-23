import { appError } from "./errors";

/**
 * Gate for internal-key functions (`api.system.*` and the domain files'
 * server-only functions): the caller must hold `CODENAYA_CONVEX_INTERNAL_KEY`,
 * which only Next.js and Inngest have (ADR 0001).
 */
export const validateInternalKey = (key: string) => {
  const internalKey = process.env.CODENAYA_CONVEX_INTERNAL_KEY;

  if (!internalKey) {
    throw new Error("CODENAYA_CONVEX_INTERNAL_KEY is not configured");
  }

  if (!keysMatch(key, internalKey)) {
    throw appError("UNAUTHENTICATED", "Invalid internal key");
  }
};

/**
 * Constant-time string compare, so response timing doesn't reveal how much of
 * a guessed key was right (#211). The Convex runtime has no
 * `crypto.timingSafeEqual`. Only the secret's length can leak.
 */
const keysMatch = (given: string, secret: string) => {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(secret);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) {
    diff |= (a[i] ?? 0) ^ b[i];
  }
  return diff === 0;
};
