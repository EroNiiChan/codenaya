import { savePendingIntent, takePendingIntent } from "@/lib/pending-intent";

/**
 * A Remix clicked while signed out, kept across the sign-up redirect so the
 * showcase page can finish it once the user is signed in.
 */
export const savePendingRemix = (showcaseId: string) =>
  savePendingIntent({ kind: "remix", showcaseId });

/** Returns the saved showcase id at most once: reading it also clears it. */
export const takePendingRemix = (): string | null => {
  const showcaseId = takePendingIntent("remix")?.showcaseId;
  return typeof showcaseId === "string" ? showcaseId : null;
};
