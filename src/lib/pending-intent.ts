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
 * Returns the saved intent if it is of `kind`, at most once: taking it clears
 * the slot. An intent of another kind is left for the page that owns it (the
 * dashboard mounts right after sign-in, before a Remix resumes on its page).
 */
export const takePendingIntent = (kind: string): Record<string, unknown> | null => {
  try {
    const raw = localStorage.getItem(PENDING_INTENT_KEY);
    const intent = raw ? (JSON.parse(raw) as Record<string, unknown> | null) : null;
    if (intent?.kind !== kind) return null;
    localStorage.removeItem(PENDING_INTENT_KEY);
    return intent;
  } catch {
    return null;
  }
};
