import { expect, test } from "@playwright/test";

test("home page renders the Predix shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Predix" })).toBeVisible();
});
