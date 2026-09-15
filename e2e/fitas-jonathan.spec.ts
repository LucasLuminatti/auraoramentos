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
const PERFIL_RIPADO = "LM1987";
const MICRO_BABY = "LM3851";
// transição de código (2026-09-15): mesmo produto; só o que tem preço na lista AURA aparece
const CODIGO_ANTIGO_COM_PRECO = "LM2440";
const CODIGO_NOVO_SEM_PRECO = "LM3634";

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

test("fora de linha e AU* somem da busca; produto ativo continua", async ({ page }) => {
  await abrirPassoDeAmbientes(page);
  const busca = page.locator('input[placeholder*="Buscar produto"]');

  // A lista vazia não prova nada sozinha (ela também está vazia antes de a busca voltar):
  // quem prova é a resposta do banco para AQUELE termo, já com o filtro de ativo.
  for (const codigo of ["AU004", "LM805"]) {
    const resposta = page.waitForResponse((r) => r.url().includes("/rest/v1/produtos") && r.url().includes(codigo));
    await busca.fill(codigo);
    const r = await resposta;
    expect(r.url()).toContain("ativo=eq.true");
    expect(await r.json()).toEqual([]);
  }

  await busca.fill("LM2029"); // fita do portfólio do Jonathan
  await expect(page.getByRole("button", { name: /^LM2029[^0-9]/i }).first()).toBeVisible({ timeout: 15_000 });
});

test("GRAN FOCUS entra como luminária, sem abrir sistema de fita", async ({ page }) => {
  await abrirPassoDeAmbientes(page);
  await adicionarAoAmbiente(page, GRAN_FOCUS);

  await expect(page.locator('input[placeholder="Código do item"]').last()).toHaveValue(GRAN_FOCUS, { timeout: 10_000 });
  await expect(page.locator('input[placeholder="Código da fita"]')).toHaveCount(0);
});

test("transição de código: aparece o código com preço AURA, não o gêmeo novo sem preço", async ({ page }) => {
  await abrirPassoDeAmbientes(page);
  const busca = page.locator('input[placeholder*="Buscar produto"]');

  const resposta = page.waitForResponse(
    (r) => r.url().includes("/rest/v1/produtos") && r.url().includes(CODIGO_NOVO_SEM_PRECO),
  );
  await busca.fill(CODIGO_NOVO_SEM_PRECO);
  expect(await (await resposta).json()).toEqual([]);

  await busca.fill(CODIGO_ANTIGO_COM_PRECO);
  await expect(
    page.getByRole("button", { name: new RegExp("^" + CODIGO_ANTIGO_COM_PRECO + "[^0-9]", "i") }).first(),
  ).toBeVisible({ timeout: 15_000 });
});

test("Micro Baby é sugerida e aceita no perfil Ripado (2ª fita Baby)", async ({ page }) => {
  await abrirPassoDeAmbientes(page);
  await adicionarAoAmbiente(page, PERFIL_RIPADO);
  await expect(page.getByText(/a fita Baby é a indicada/i)).toBeVisible({ timeout: 15_000 });

  const descricaoFita = page
    .locator('input[placeholder="Código da fita"]')
    .last()
    .locator("xpath=following::input[@placeholder='Descrição'][1]");
  await page.getByRole("button", { name: new RegExp(MICRO_BABY) }).first().click();

  await expect(descricaoFita).toHaveValue(/MICRO BABY/i);
  await expect(page.getByText(/não cabe no canal/i)).toHaveCount(0);
});
