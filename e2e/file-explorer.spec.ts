import { expect, test } from "@playwright/test";

import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { hasClerkCredentials, signIn } from "./clerk-auth";
import { collectConsoleErrors } from "./console-errors";
import { userConvexClient } from "./convex-client";

/**
 * Clicking a file the moment it's created used to open its optimistic id,
 * crash `files.getFile` and replace the IDE with "Project not found" (#266).
 */
test.describe("file explorer", () => {
  test.skip(!hasClerkCredentials(), "Needs CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");

  test("a file clicked right after it's created opens in the editor", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectConsoleErrors(page);
    await signIn(page);
    const user = await userConvexClient(page);
    const projectId: Id<"projects"> = await user.mutation(api.projects.create, {
      name: `e2e-explorer-${Date.now()}`,
    });

    try {
      await page.goto(`/projects/${projectId}?engine=webcontainer`);
      await page.getByRole("button", { name: "Create file", exact: true }).click();
      await page.keyboard.type("quick.ts");
      await page.keyboard.press("Enter");
      await page.getByText("quick.ts", { exact: true }).first().click();

      // The editor mounts only once a file is open. Checked this way rather than by
      // the file's tab, whose role changes with #265.
      await expect(page.locator(".cm-editor")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Project not found" })).toHaveCount(0);
      expect(errors.filter((error) => !error.includes("webcontainer-api.io"))).toEqual([]);
    } finally {
      await user.mutation(api.projects.remove, { id: projectId }).catch(() => {});
    }
  });
});
