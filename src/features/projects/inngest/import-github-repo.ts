import ky from "ky";
import { isBinaryFile } from "isbinaryfile";
import { NonRetriableError } from "inngest";

import { convex } from "@/lib/convex-client";
import { inngest } from "@/inngest/client";
import { getJobGithubToken } from "@/features/projects/server/github-token";
import { readRepoArchive } from "@/features/projects/server/github-archive";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

interface ImportGithubRepoEvent {
  owner: string;
  repo: string;
  projectId: Id<"projects">;
  userId: string;
}

export const importGithubRepo = inngest.createFunction(
  {
    id: "import-github-repo",
    triggers: [{ event: "github/import.repo" }],
    onFailure: async ({ event, step }) => {
      const internalKey = process.env.CODENAYA_CONVEX_INTERNAL_KEY;
      if (!internalKey) return;

      const { projectId } = event.data.event.data as ImportGithubRepoEvent;

      await step.run("set-failed-status", async () => {
        await convex.mutation(api.system.updateImportStatus, {
          internalKey,
          projectId,
          status: "failed",
        });
      });
    },
  },
  async ({ event, step }) => {
    const { owner, repo, projectId, userId } =
      event.data as ImportGithubRepoEvent;

    const internalKey = process.env.CODENAYA_CONVEX_INTERNAL_KEY;
    if (!internalKey) {
      throw new NonRetriableError("CODENAYA_CONVEX_INTERNAL_KEY is not configured");
    };

    // No linked account: the route checked the repo is public, so read it
    // unauthenticated (#364).
    const githubToken = await getJobGithubToken({ internalKey, userId, projectId });

    // One step: the archive can't be passed between steps (step output is
    // persisted), and a retry starts again from a clean project.
    await step.run("import-files", async () => {
      await convex.mutation(api.system.cleanup, {
        internalKey,
        projectId
      });

      const { folders, files } = await readRepoArchive(owner, repo, githubToken);

      // Sort folders by depth so parents are created before children
      // Input:  ["src/components", "src", "src/components/ui"]
      // Output: ["src", "src/components", "src/components/ui"]
      folders.sort((a, b) => a.split("/").length - b.split("/").length);

      const folderIdMap: Record<string, Id<"files">> = {};

      for (const folder of folders) {
        const pathParts = folder.split("/");
        const name = pathParts.pop()!;
        const parentPath = pathParts.join("/");
        const parentId = parentPath ? folderIdMap[parentPath] : undefined;

        folderIdMap[folder] = await convex.mutation(api.system.createFolder, {
          internalKey,
          projectId,
          name,
          parentId,
        });
      }

      for (const file of files) {
        try {
          const buffer = file.content;
          const isBinary = await isBinaryFile(buffer);

          const pathParts = file.path.split("/");
          const name = pathParts.pop()!;
          const parentPath = pathParts.join("/");
          const parentId = parentPath ? folderIdMap[parentPath] : undefined;

          if (isBinary) {
            const uploadUrl = await convex.mutation(
              api.system.generateUploadUrl,
              { internalKey }
            );

            const { storageId } = await ky
              .post(uploadUrl, {
                headers: { "Content-Type": "application/octet-stream" },
                body: buffer,
              })
              .json<{ storageId: Id<"_storage"> }>();

            await convex.mutation(api.system.createBinaryFile, {
              internalKey,
              projectId,
              name,
              storageId,
              parentId,
            });
          } else {
            const content = buffer.toString("utf-8");

            await convex.mutation(api.system.createFile, {
              internalKey,
              projectId,
              name,
              content,
              parentId,
            });
          }
        } catch {
          console.error(`Failed to import file: ${file.path}`);
        }
      }
    });

    await step.run("set-completed-status", async () => {
      await convex.mutation(api.system.updateImportStatus, {
        internalKey,
        projectId,
        status: "completed",
      });
    });

    return { success: true, projectId };
  }
);
