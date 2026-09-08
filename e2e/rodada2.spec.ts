import { test, expect, type Page } from "@playwright/test";

/**
 * Regras da 2ª rodada de respostas (2026-09-08) — RULE-009 (passadas pelo canal),
 * RULE-103 (fita Baby: bloqueio) e RULE-108 (spot TINY exige driver 24V).
 *
 * Nenhum destes testes chega a gravar: o wizard só escreve no banco em "Gerar PDF",
 * e todos param no passo de ambientes. Por isso não há cleanup — de propósito.
 */

const PERFIL_30MM = "LM1997";   // canal até 30mm, catálogo com passadas_padrao=1
const PERFIL_RIPADO = "LM1987"; // canal estreito (Baby-only pela família/nome)
const FITA_COMUM = "LM1149";    // não é Baby
const SPOT_TINY_5W = "LM3182";
const SPOT_TINY_1W = "LM3177";

/** Vai do login até o passo de ambientes com um ambiente vazio criado. */
async function abrirPassoDeAmbientes(page: Page) {
  await page.goto("/");
  await expect(page.getByText(/Clientes/i).first()).toBeVisible({ timeout: 20_000 });

  // rascunho de uma execução anterior não pode contaminar o teste
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

  // passo de categorias de fita — segue sem criar nenhuma
  await expect(page.getByRole("heading", { name: /Categorias de Fita/i })).toBeVisible();
  await page.getByRole("button", { name: /Próximo/i }).click();

  await expect(page.getByRole("heading", { name: /Ambientes e Itens/i })).toBeVisible();
  await page.getByRole("button", { name: /Adicionar Ambiente/i }).click();
}

/** Busca o produto no campo "Adicionar ao ambiente" e clica no resultado. */
async function adicionarAoAmbiente(page: Page, codigo: string) {
  await page.locator('input[placeholder*="Buscar produto"]').fill(codigo);
  const opcao = page.getByRole("button", { name: new RegExp(`^${codigo}\\b`, "i") }).first();
  await expect(opcao).toBeVisible({ timeout: 15_000 });
  await opcao.click();
}

test("RULE-009: perfil de canal 30mm entra com 2 passadas e o seletor não trava", async ({ page }) => {
  await abrirPassoDeAmbientes(page);
  await adicionarAoAmbiente(page, PERFIL_30MM);

  // o número saiu do canal declarado no nome, não do passadas_padrao (que é 1)
  const passadas = page.getByRole("combobox").filter({ hasText: /^[123]$/ }).last();
  await expect(passadas).toHaveText("2");
  await expect(page.getByText(/cabem 2 passadas de fita de 12mm/i)).toBeVisible();

  // "que não fique travado": as três opções continuam disponíveis
  await passadas.click();
  await expect(page.getByRole("option", { name: "1" })).toBeVisible();
  await expect(page.getByRole("option", { name: "3" })).toBeVisible();

  // baixar para 1 volta a avisar que o canal é largo
  await page.getByRole("option", { name: "1" }).click();
  await expect(page.getByText(/está com 1 passada/i)).toBeVisible();
});

test("RULE-108: spot TINY sem driver 24V avisa com a potência somada", async ({ page }) => {
  await abrirPassoDeAmbientes(page);
  await adicionarAoAmbiente(page, SPOT_TINY_5W);
  await expect(page.getByText(/Linha TINY 24V/i).first()).toBeVisible({ timeout: 10_000 });

  await adicionarAoAmbiente(page, SPOT_TINY_1W);

  await page.getByRole("button", { name: /Próximo/i }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/Spot da linha TINY sem driver 24V/i);
  await expect(dialog).toContainText(/6W somados nos spots TINY/i);
  await expect(dialog).toContainText(/no mínimo 8W/i); // 6W × 1,20 de folga
  await dialog.getByRole("button", { name: /Revisar/i }).click();
});

test("RULE-103: perfil estreito recusa fita que não é Baby", async ({ page }) => {
  await abrirPassoDeAmbientes(page);
  await adicionarAoAmbiente(page, PERFIL_RIPADO);

  // a sugestão da Baby aparece (a única que sobrevive sem largura_mm no cadastro)
  await expect(page.getByText(/a fita Baby é a indicada/i)).toBeVisible({ timeout: 15_000 });

  // O campo de código guarda o que foi DIGITADO mesmo quando a escolha é recusada — quem
  // diz se a fita entrou de verdade é a descrição, que só o produto aplicado preenche.
  const buscaFita = page.locator('input[placeholder="Código da fita"]').last();
  const descricaoFita = buscaFita.locator(
    "xpath=following::input[@placeholder='Descrição'][1]",
  );

  await buscaFita.fill(FITA_COMUM);
  const opcao = page.getByRole("button", { name: new RegExp(`^${FITA_COMUM}\\b`, "i") }).first();
  await expect(opcao).toBeVisible({ timeout: 15_000 });
  await opcao.click();

  // bloqueia (decisão da Paolla em 2026-09-08: "nesse caso prefiro que trave").
  // "não cabe no canal" é do texto do BLOQUEIO — o alerta anterior não dizia isso.
  await expect(page.getByText(/não cabe no canal/i).first()).toBeVisible();
  await expect(descricaoFita).toHaveValue("");

  // a Baby sugerida, essa sim, entra com um clique
  await page.getByRole("button", { name: /LM3827/ }).first().click();
  await expect(descricaoFita).toHaveValue(/BABY/i);
});
