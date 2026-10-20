/**
 * Something a signed-out visitor started (a Remix, an "Open in Codenaya"
 * import), kept across the sign-up redirect so it can be finished once they
 * are signed in. There is one slot: saving an intent replaces the last one.
 * Storage can be unavailable (private mode, blocked site data), so every
 * access is best-effort.
 */
export const PENDING_INTENT_KEY = "codenaya:pendingIntent";

export const savePendingIntent = (intent: { kind: string; [field: string]: string }) => {
  try {
    localStorage.setItem(PENDING_INTENT_KEY, JSON.stringify(intent));
  } catch {
    // Without storage the intent is simply not resumed.
  }
};

/**
 * Returns the saved intent if it is of `kind`, at most once: reading it also
 * clears the slot, whatever its kind.
 */
export const takePendingIntent = (kind: string): Record<string, unknown> | null => {
  try {
    const raw = localStorage.getItem(PENDING_INTENT_KEY);
    localStorage.removeItem(PENDING_INTENT_KEY);
    const intent = raw ? (JSON.parse(raw) as Record<string, unknown> | null) : null;
    return intent?.kind === kind ? intent : null;
  } catch {
    return null;
  }
};
