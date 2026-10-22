import { expect, test } from "@playwright/test";

import {
  addTestingToken,
  ensureTestUser,
  hasClerkCredentials,
  signIn,
  signInWithTicket,
} from "./clerk-auth";

const NOT_FOUND_HEADING = { level: 1, name: "Page not found" } as const;

test("/admin is a 404 for signed-out visitors, with no sign-in redirect", async ({ page }) => {
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", NOT_FOUND_HEADING)).toBeVisible();
});

test("GET /api/admin/models is a 404 when signed out", async ({ request }) => {
  const response = await request.get("/api/admin/models");
  expect(response.status()).toBe(404);
});

test("/admin is a 404 for a signed-in user who isn't the admin", async ({ page }) => {
  test.skip(!hasClerkCredentials(), "Needs CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  await signIn(page);

  const page404 = await page.goto("/admin");
  expect(page404?.status()).toBe(404);
  await expect(page.getByRole("heading", NOT_FOUND_HEADING)).toBeVisible();
  const api404 = await page.request.get("/api/admin/models");
  expect(api404.status()).toBe(404);
});

test("the admin sees the model panel", async ({ page }) => {
  // The Convex deployment's ADMIN_EMAIL must be this verified Clerk test user.
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  test.skip(!hasClerkCredentials() || !adminEmail, "Needs Clerk secrets and E2E_ADMIN_EMAIL");
  await addTestingToken(page);
  await signInWithTicket(page, (await ensureTestUser(adminEmail)).id);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Admin" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Models" })).toBeVisible();
  await expect(page.getByText("Platform provider")).toBeVisible();
  await page.getByRole("tab", { name: "Audit log" }).click();
  await expect(page.getByText("Who changed what")).toBeVisible();
});
