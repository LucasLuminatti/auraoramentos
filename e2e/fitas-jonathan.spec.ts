import { test, expect, type Page } from "@playwright/test";

/**
 * Reclassificação vinda da planilha de fitas do Jonathan (2026-09-14):
 *   - PERFIL FLEXIVEL já tem LED (12V, 10 W/m, rolo) → é fita, não perfil;
 *   - GRAN FOCUS / FOCUS com fita embutida → não é fita (luminária).
 * A mudança é só de cadastro; o teste confere que o roteamento da busca respeita o dado.
 * Nenhum teste grava: param no passo de ambientes.
 */

const PERFIL_FLEXIVEL = "LM1478";
const GRAN_FOCUS = "LM3257";

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

test("perfil flexível entra como FITA do sistema, não como perfil", async ({ page }) => {
  await abrirPassoDeAmbientes(page);
  await adicionarAoAmbiente(page, PERFIL_FLEXIVEL);

  const codigoFita = page.locator('input[placeholder="Código da fita"]').last();
  await expect(codigoFita).toBeVisible({ timeout: 10_000 });
  const descricaoFita = codigoFita.locator("xpath=following::input[@placeholder='Descrição'][1]");
  await expect(descricaoFita).toHaveValue(/PERFIL FLEXIVEL/i);
});

test("GRAN FOCUS entra como luminária, sem abrir sistema de fita", async ({ page }) => {
  await abrirPassoDeAmbientes(page);
  await adicionarAoAmbiente(page, GRAN_FOCUS);

  await expect(page.locator('input[placeholder="Código do item"]').last()).toHaveValue(GRAN_FOCUS, { timeout: 10_000 });
  await expect(page.locator('input[placeholder="Código da fita"]')).toHaveCount(0);
});
