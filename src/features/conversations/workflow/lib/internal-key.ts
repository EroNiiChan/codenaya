/**
 * The Convex internal key, read inside each `"use step"` body. Workflow inputs
 * and step arguments are persisted in the run's event log, so the key must
 * never be one of them (#211).
 */
export function readInternalKey(): string {
  const key = process.env.CODENAYA_CONVEX_INTERNAL_KEY;
  if (!key) {
    throw new Error("CODENAYA_CONVEX_INTERNAL_KEY is not configured");
  }
  return key;
}
