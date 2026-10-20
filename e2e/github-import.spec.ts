import { expect, test } from "@playwright/test";

import { hasClerkCredentials, signIn } from "./clerk-auth";
import { collectConsoleErrors } from "./console-errors";

test.describe("GitHub import", () => {
  test.skip(
    !hasClerkCredentials(),
    "Needs CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  );

  test("asks to connect GitHub for a private or missing repo when the account is not linked", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectConsoleErrors(page);

    // The e2e user is created with an email only, so no GitHub account is linked.
    await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: /Import from GitHub/ }).first().click();

    const dialog = page.getByRole("dialog", { name: "Import from GitHub" });
    await dialog.getByLabel("Repository URL").fill("https://github.com/itsmrad/codenaya-no-such-repo");
    await dialog.getByRole("button", { name: "Import" }).click();

    // Public repos import without GitHub (#364), so use one that doesn't exist.
    await expect(dialog.getByText("GitHub account not connected")).toBeVisible();
    await expect(dialog.getByText(/private or doesn't exist/)).toBeVisible();
    await dialog.getByRole("link", { name: "Connect GitHub" }).click();
    await expect(page).toHaveURL(/\/settings\/account$/);

    // The route answers 400 GITHUB_NOT_LINKED, which the browser logs as a failed load.
    expect(errors.filter((error) => !error.includes("status of 400"))).toEqual([]);
  });

  test("an Open in Codenaya link opens the import dialog prefilled (#231)", async ({ page }) => {
    await signIn(page);
    await page.goto("/import?repo=octocat/Hello-World");

    const dialog = page.getByRole("dialog", { name: "Import from GitHub" });
    await expect(dialog.getByLabel("Repository URL")).toHaveValue(
      "https://github.com/octocat/Hello-World",
    );
    // Nothing is imported until the user confirms.
    await expect(page).toHaveURL(/\/\?import=octocat(\/|%2F)Hello-World$/);
  });

  test("a malformed Open in Codenaya link explains itself (#231)", async ({ page }) => {
    await page.goto("/import?repo=../etc/passwd");
    await expect(page.getByRole("heading", { name: "Can't open that repository" })).toBeVisible();
  });
});
