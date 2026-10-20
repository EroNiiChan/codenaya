import { savePendingIntent, takePendingIntent } from "@/lib/pending-intent";

/**
 * A repo from an "Open in Codenaya" link (/import) opened while signed out,
 * kept across the sign-up redirect so the dashboard can open the import
 * dialog once the user is signed in.
 */
export const savePendingImport = (repo: string) =>
  savePendingIntent({ kind: "import", repo });

/** Returns the saved repo at most once: reading it also clears it. */
export const takePendingImport = (): string | null => {
  const repo = takePendingIntent("import")?.repo;
  return typeof repo === "string" ? repo : null;
};
