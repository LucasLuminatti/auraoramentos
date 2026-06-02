import { test, expect } from "@playwright/test";

/**
 * Fluxo de login. Roda com estado limpo (sem o storageState autenticado), pra
 * exercitar a tela /auth de verdade.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("login com credenciais válidas entra no sistema", async ({ page }) => {
  const email = process.env.E2E_EMAIL!;
  const password = process.env.E2E_PASSWORD!;

  await page.goto("/auth");
  await page.getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByRole("textbox", { name: "Senha" }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/orcamentosaura\.com\.br\/?$/);
  await expect(page.getByText(/Clientes/i).first()).toBeVisible({ timeout: 20_000 });
});

test("login com senha errada não entra e continua em /auth", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("textbox", { name: "E-mail" }).fill(process.env.E2E_EMAIL!);
  await page.getByRole("textbox", { name: "Senha" }).fill("senha-errada-de-proposito");
  await page.getByRole("button", { name: "Entrar" }).click();

  // continua na tela de auth (não redireciona pra home protegida)
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("rota protegida sem sessão redireciona pra /auth", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth/);
});
