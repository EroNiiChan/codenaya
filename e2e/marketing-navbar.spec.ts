import { expect, test } from "@playwright/test";

import { collectConsoleErrors } from "./console-errors";

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

const LINKS = ["Showcase", "Pricing", "Docs"] as const;

// Each public route and the header link that should be marked current on it.
const ROUTES = [
  { path: "/", current: null },
  { path: "/pricing", current: "Pricing" },
  { path: "/docs", current: "Docs" },
  { path: "/showcase", current: "Showcase" },
  { path: "/terms", current: null },
  { path: "/privacy", current: null },
  { path: "/sign-in", current: null },
  { path: "/sign-up", current: null },
  { path: "/this-page-does-not-exist", current: null },
] as const;

test.describe("marketing navbar (signed out)", () => {
  for (const viewport of VIEWPORTS) {
    test(`every public route shares the header at ${viewport.width}px`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize(viewport);
      const errors = collectConsoleErrors(page);
      const mobile = viewport.width < 768;

      for (const { path, current } of ROUTES) {
        await page.goto(path);
        const header = page.locator("header").first();
        await expect(header.getByRole("link", { name: "Codenaya" })).toBeVisible();
        const bar = await header.getByRole("navigation", { name: "Main" }).boundingBox();
        expect(bar?.height, `${path} bar height`).toBeCloseTo(64, 0);

        // Below md the links live in the sheet behind the menu button.
        if (mobile) await header.getByRole("button", { name: "Toggle menu" }).click();
        const scope = mobile ? page.getByRole("dialog") : header;

        for (const name of LINKS) {
          const link = scope.getByRole("link", { name, exact: true });
          await expect(link, `${path}: ${name}`).toBeVisible();
          if (name === current) await expect(link).toHaveAttribute("aria-current", "page");
          else await expect(link).not.toHaveAttribute("aria-current");
        }
        await expect(scope.getByRole("link", { name: "Log in" })).toBeVisible();
        await expect(scope.getByRole("link", { name: "Sign Up" })).toBeVisible();

        if (mobile) await page.keyboard.press("Escape");
      }

      await page.waitForLoadState("networkidle");
      // The browser logs the 404 route's own document response as a failed load.
      expect(errors.filter((error) => !error.includes("status of 404"))).toEqual([]);
    });
  }

  test("the header link moves between public pages", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/pricing");

    await page.locator("header").getByRole("link", { name: "Docs", exact: true }).click();
    await expect(page).toHaveURL(/\/docs$/);
    await expect(
      page.locator("header").getByRole("link", { name: "Docs", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });
});
