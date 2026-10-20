import { PENDING_REMIX_KEY } from "@/features/showcase/utils/pending-remix";

/**
 * A repo from an "Open in Codenaya" link (/import) opened while signed out,
 * kept across the sign-up redirect so the dashboard can open the import
 * dialog once the user is signed in. Shares the pending-intent slot with
 * Remix: only the latest intent is kept. Storage can be unavailable (private
 * mode, blocked site data), so every access is best-effort.
 */
type PendingImport = { kind: "import"; repo: string };

export const savePendingImport = (repo: string) => {
  try {
    const intent: PendingImport = { kind: "import", repo };
    localStorage.setItem(PENDING_REMIX_KEY, JSON.stringify(intent));
  } catch {
    // Without storage the import is simply not resumed.
  }
};

/** Returns the saved repo at most once: reading it also clears it. */
export const takePendingImport = (): string | null => {
  try {
    const raw = localStorage.getItem(PENDING_REMIX_KEY);
    localStorage.removeItem(PENDING_REMIX_KEY);
    const intent = raw ? (JSON.parse(raw) as Partial<PendingImport>) : null;
    return intent?.kind === "import" && typeof intent.repo === "string"
      ? intent.repo
      : null;
  } catch {
    return null;
  }
};
