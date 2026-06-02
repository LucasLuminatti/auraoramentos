import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const AUTH_FILE = "e2e/.auth/user.json";

/**
 * Loga uma vez e salva o storageState (inclui o localStorage da sessão Supabase).
 * Os demais specs reusam esse estado → já entram autenticados.
 */
setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) throw new Error("Faltam E2E_EMAIL / E2E_PASSWORD no .env.local");

  await page.goto("/auth");
  await page.getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByRole("textbox", { name: "Senha" }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  // login OK → redireciona pra home (raiz) e mostra a saudação
  await expect(page).toHaveURL(/orcamentosaura\.com\.br\/?$/);
  await expect(page.getByText(/Bom dia|Boa tarde|Boa noite|lenny\.wajcberg/i)).toBeVisible({ timeout: 20_000 });

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
