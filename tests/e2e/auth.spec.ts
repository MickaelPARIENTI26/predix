import { expect, test } from "@playwright/test";

// These tests never complete a real auth round-trip (CI runs against a dummy
// Supabase URL). They cover rendering, client-side validation and route
// protection — all observable without a live backend.

test("landing shows auth CTAs when logged out", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Créer un compte" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Se connecter" })).toBeVisible();
});

test("login form shows a validation error on empty submit", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Adresse email invalide.")).toBeVisible();
});

test("signup form rejects a short password client-side", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Nom affiché").fill("Mika");
  await page.getByLabel("Email").fill("mika@example.com");
  await page.getByLabel("Mot de passe").fill("short");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Au moins 8 caractères.")).toBeVisible();
});

test("navigation between login and signup works", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.getByRole("link", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("visiting a protected route while logged out redirects to login", async ({
  page,
}) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile/);
});
