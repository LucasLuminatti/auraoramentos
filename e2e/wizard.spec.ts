import { test, expect } from "@playwright/test";
import { snapshotOrcamentoIds, deleteOrcamentoDeTeste } from "./helpers/supabaseAdmin";

/**
 * Fluxo de ponta a ponta do orçamento: abre cliente/projeto existente, cria um
 * orçamento, busca um produto no autocomplete (valida que preço vem da tabela),
 * e gera o PDF. CRIA dados em produção — o afterEach apaga via service role.
 *
 * Usa um produto com foto conhecida pra também exercitar o pipeline de imagem no PDF.
 */
const PRODUTO = { codigo: "LM029", precoEsperado: "25" }; // BULBO LED 7W, R$ 25,15
const TIPO = "Primeiro Orçamento";
const VALOR_ESPERADO = 25.15; // 1x LM029

// Impressão digital pra cleanup seguro (não apaga dado real)
let janelaInicio: string;
let idsAntes: Set<string>;

test.beforeEach(async () => {
  janelaInicio = new Date(Date.now() - 120_000).toISOString(); // cobre skew de relógio
  idsAntes = await snapshotOrcamentoIds();
});

test.afterEach(async () => {
  // O rascunho é auto-salvo com debounce — a gravação pode chegar logo APÓS o teste.
  // Faz poll curto pra não deixar lixo se a linha aparecer atrasada. Apaga SÓ a linha
  // nova com a fingerprint do teste (id novo + tipo + valor + status). Nunca toca dado real.
  let total = 0;
  for (let i = 0; i < 6; i++) {
    total += await deleteOrcamentoDeTeste(idsAntes, janelaInicio, { tipo: TIPO, valor: VALOR_ESPERADO, status: "rascunho" });
    if (total >= 1) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log(`[cleanup] orçamentos de teste apagados: ${total}`);
  expect(total, "cleanup não deve apagar mais de 1 linha").toBeLessThanOrEqual(1);
});

test("criar orçamento → autocomplete com preço → gerar PDF", async ({ page }) => {
  await page.goto("/");

  // 1. abre o primeiro cliente (botão que menciona "projeto")
  await expect(page.getByText(/Clientes/i).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /\d+\s*projetos?/i }).first().click();

  // 2. abre o primeiro projeto (menciona "orçamento", não "projeto" nem "Novo")
  await page
    .getByRole("button", { name: /\d+\s*or[çc]amentos?/i })
    .filter({ hasNotText: /projeto/i })
    .first()
    .click();

  // 3. Novo Orçamento → Step 1
  await page.getByRole("button", { name: /Novo Or[çc]amento/i }).click();

  // Step 1 — tipo
  await expect(page.getByRole("heading", { name: /Dados do Orçamento/i })).toBeVisible();
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: /Primeiro Orçamento/i }).click();
  await page.getByRole("button", { name: /Próximo/i }).click();

  // Step 2 — adicionar ambiente + luminária
  await expect(page.getByRole("heading", { name: /Ambientes e Itens/i })).toBeVisible();
  await page.getByRole("button", { name: /Adicionar Ambiente/i }).click();
  await page.getByRole("button", { name: /Adicionar Luminária/i }).click();

  // autocomplete: digita código → opção aparece → seleciona
  await page.getByRole("textbox", { name: /Código do item/i }).first().fill(PRODUTO.codigo);
  const opcao = page.getByRole("button", { name: new RegExp(`${PRODUTO.codigo}.*BULBO`, "i") });
  await expect(opcao).toBeVisible({ timeout: 15_000 });
  // o dropdown já mostra o preço de tabela integrado
  await expect(opcao).toContainText(/R\$\s*25/);
  await opcao.click();

  // preço veio da tabela automaticamente → subtotal calculado aparece no card
  await expect(page.getByText(/Subtotal:\s*R\$\s*25,15/i)).toBeVisible();

  await page.getByRole("button", { name: /Próximo/i }).click();

  // Step 3 — revisão mostra o item e total
  await expect(page.getByRole("heading", { name: /Revisão do Orçamento/i })).toBeVisible();
  await expect(page.getByText(PRODUTO.codigo).first()).toBeVisible();
  await expect(page.getByText(/Total Geral/i)).toBeVisible();

  // gera o PDF (download)
  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await page.getByRole("button", { name: /Gerar PDF/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
});
