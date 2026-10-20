import { convex } from "@/lib/convex-client";

import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

/**
 * Looks up a file by an ID the agent supplied. A malformed or wrong-table ID
 * is the agent's mistake, not a transient failure, so `getFileById` resolves
 * it to null like a missing file; throwing inside step.run would make Inngest
 * retry the step before the agent ever sees it. A file from another project
 * is also null (#209). Any other error still throws so Inngest can retry it.
 */
export const getFileByAgentId = (
  internalKey: string,
  projectId: Id<"projects">,
  fileId: string
) => convex.query(api.system.getFileById, { internalKey, projectId, fileId });
