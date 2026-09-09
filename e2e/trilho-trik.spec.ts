import { test, expect, type Page } from "@playwright/test";

/**
 * Regras destravadas pelo PDF do catálogo (2026-09-09):
 *  - RULE-102/029/100: o perfil Trik (LM2951…LM2956) é a linha "PERFIL DE SOBREPOR
 *    INDIRETO" — nome que nunca casou com a detecção. Passou a entrar com 2 passadas.
 *  - RULE-057/059: "TRILHO DE SOBREPOR" (LM934…LM939) é o trilho de 2 fios da R4, e os
 *    conectores de emenda são LM940…LM947. Do segundo trilho em diante, avisa.
 *
 * Nenhum teste grava: todos param no passo de ambientes.
 */

const PERFIL_TRIK = "LM2951";  // PERFIL DE SOBREPOR INDIRETO, BR, TAM: 1M
const TRILHO_BRANCO = "LM934"; // TRILHO DE SOBREPOR, BRANCO - 1 METRO

async function abrirPassoDeAmbientes(page: Page) {
  await page.goto("/");
  await expect(page.getByText(/Clientes/i).first()).toBeVisible({ timeout: 20_000 });
  const descartar = page.getByRole("button", { name: /^Descartar$/i });
  if (await descartar.isVisible().catch(() => false)) await descartar.click();
  await page.getByRole("button", { name: /\d+\s*projetos?/i }).first().click();
  await page
    .getByRole("button", { name: /\d+\s*or[çc]amentos?/i })
    .filter({ hasNotText: /projeto/i })
    .first()
    .click();
  await page.getByRole("button", { name: /Novo Or[çc]amento/i }).click();
  await expect(page.getByRole("heading", { name: /Dados do Orçamento/i })).toBeVisible();
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: /Primeiro Orçamento/i }).click();
  await page.getByRole("button", { name: /Próximo/i }).click();
  await expect(page.getByRole("heading", { name: /Categorias de Fita/i })).toBeVisible();
  await page.getByRole("button", { name: /Próximo/i }).click();
  await expect(page.getByRole("heading", { name: /Ambientes e Itens/i })).toBeVisible();
  await page.getByRole("button", { name: /Adicionar Ambiente/i }).click();
}

async function adicionarAoAmbiente(page: Page, codigo: string) {
  await page.locator('input[placeholder*="Buscar produto"]').fill(codigo);
  const opcao = page.getByRole("button", { name: new RegExp("^" + codigo + "[^0-9]", "i") }).first();
  await expect(opcao).toBeVisible({ timeout: 15_000 });
  await opcao.click();
}

test("Trik entra com 2 passadas (o nome do produto não diz 'Trik')", async ({ page }) => {
  await abrirPassoDeAmbientes(page);
  await adicionarAoAmbiente(page, PERFIL_TRIK);

  await expect(page.locator('input[placeholder="Código do perfil"]').last()).toHaveValue(PERFIL_TRIK);
  const passadas = page.getByRole("combobox").filter({ hasText: /^[123]$/ }).last();
  await expect(passadas).toHaveText("2");
});

test("RULE-059: o segundo trilho de sobrepor pede o conector de emenda", async ({ page }) => {
  await abrirPassoDeAmbientes(page);

  // um trilho sozinho não precisa de conector — nada de aviso
  await adicionarAoAmbiente(page, TRILHO_BRANCO);
  await expect(page.getByText(/conector/i)).toHaveCount(0);

  // o segundo dispara o lembrete, já com os códigos na cor do trilho
  await adicionarAoAmbiente(page, TRILHO_BRANCO);
  await expect(page.getByText(/2 trilhos no ambiente/i).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/LM940/).first()).toBeVisible();

  // e ao avançar o advisory repete (RULE-057: lembrete que volta na saída)
  await page.getByRole("button", { name: /Próximo/i }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/sem conector de emenda/i);
  await expect(dialog).toContainText(/2 trilhos de sobrepor/i);
  await dialog.getByRole("button", { name: /Revisar/i }).click();
});
