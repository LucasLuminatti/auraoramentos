import { test, expect, type Page } from "@playwright/test";

/**
 * Erros de valor do sistema composto (auditoria 2026-09-15, seção 2):
 *  - o driver entrava com quantidade fixa 1 mesmo quando a carga pedia N circuitos;
 *  - conector e kit de fixação eram cobrados sem aparecer em lugar nenhum do card.
 *
 * Nenhum teste grava: o wizard só escreve no banco em "Gerar PDF" e todos param no
 * passo de ambientes (mesma premissa de rodada2.spec.ts).
 */

const TRILHO_48V = "LM2331";  // TRILHO DE SOBREPOR MAGNETICO PT 1M - MAX. 48V
const MODULO_24W = "LM2946";  // MODULO DIFUSO MAGNETICO 24W 48V
const CONECTOR_48V = "LM2338"; // CONECTOR DE ENERGIA DIRECIONAVEL (default do magneto)

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
  const opcao = page.getByRole("button", { name: new RegExp(`^${codigo}\\b`, "i") }).first();
  await expect(opcao).toBeVisible({ timeout: 15_000 });
  await opcao.click();
}

/** Abre a busca de módulo do card do composto e insere o SKU. */
async function adicionarModulo(page: Page, codigo: string) {
  await page.getByRole("button", { name: /\+ Adicionar módulo/i }).first().click();
  await page.locator('input[placeholder*="Buscar módulo"]').fill(codigo);
  const opcao = page.getByRole("button", { name: new RegExp(`^${codigo}\\b`, "i") }).first();
  await expect(opcao).toBeVisible({ timeout: 15_000 });
  await opcao.click();
}

test("driver do composto entra com um por circuito quando a carga passa de 200W", async ({ page }) => {
  await abrirPassoDeAmbientes(page);
  await adicionarAoAmbiente(page, TRILHO_48V);
  await adicionarModulo(page, MODULO_24W);

  // 1 módulo de 24W: um driver de 100W dá conta (24 × 1,2 = 28,8W)
  await expect(page.getByText(/Driver recomendado: LM2343/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/1 unidade/i)).toBeVisible();

  // 10 módulos = 240W → 288W com folga → dois drivers de 200W
  const qtdModulo = page.getByLabel(`Quantidade ${MODULO_24W}`);
  await qtdModulo.fill("10");
  const botaoCircuitos = page.getByRole("button", { name: /Aplicar 2×\s*LM2344/i });
  await expect(botaoCircuitos).toBeVisible({ timeout: 10_000 });
  await botaoCircuitos.click();

  // o box do driver aplicado continua na tela (acima de 200W ele desaparecia) com qtd 2
  await expect(page.getByText(/Driver aplicado: LM2344/i)).toBeVisible({ timeout: 10_000 });
  const qtdDriver = page.getByLabel(/Quantidade de drivers/i);
  await expect(qtdDriver).toHaveValue("2");

  // e a quantidade é editável (RULE-001) — 3 circuitos é decisão de projeto
  await qtdDriver.fill("3");
  await expect(page.getByText(/= 600W/i)).toBeVisible();
});

test("conector adicionado pelo checklist aparece com quantidade e preço", async ({ page }) => {
  await abrirPassoDeAmbientes(page);
  await adicionarAoAmbiente(page, TRILHO_48V);

  // checklist acusa a ausência e oferece o default
  await expect(page.getByText(new RegExp(`Conector ${CONECTOR_48V}`, "i"))).toBeVisible({ timeout: 10_000 });
  // nome exato: "+ Adicionar módulo" também casaria com /\+ Adicionar/
  await page.getByRole("button", { name: "+ Adicionar", exact: true }).click();

  // antes: entrava na composição (e no subtotal) sem linha nenhuma na tela
  await expect(page.getByText(/Outros componentes/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`input[value="${CONECTOR_48V}"]`)).toBeVisible();
  await expect(page.getByText(new RegExp(`Conector ${CONECTOR_48V}.*presente`, "i"))).toBeVisible();
});

const PERFIL_MODULAR = "LM2109"; // SYSTEM MOLD 22 PERFIL DE EMBUTIR MODULAR
const DIFUSO_660 = "LM2273";     // MODULO DIFUSO Q(5) PARA FITA LED 660MM
const FITA_5M = "LM2040";        // FITA LED 11W/M 24V, rolo de 5 m

test("fita do SYSTEM MOLD é cobrada em rolos e acompanha os difusos", async ({ page }) => {
  await abrirPassoDeAmbientes(page);
  await adicionarAoAmbiente(page, PERFIL_MODULAR);
  await adicionarModulo(page, DIFUSO_660);

  await page.getByRole("button", { name: /Adicionar fita/i }).click();
  await page.locator('input[placeholder*="Buscar fita"]').fill(FITA_5M);
  const opcao = page.getByRole("button", { name: new RegExp(`^${FITA_5M}\\b`, "i") }).first();
  await expect(opcao).toBeVisible({ timeout: 15_000 });
  await opcao.click();

  // 0,66 m → 1 rolo; o painel de driver mostra a sugestão (difuso não tem potência própria)
  await expect(page.getByText(/(^|\D)1×5m/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Driver recomendado/i)).toBeVisible({ timeout: 15_000 });

  // 10 difusos = 6,6 m → 2 rolos (antes a linha ficava em 1 rolo)
  await page.getByLabel(`Quantidade ${DIFUSO_660}`).fill("10");
  await expect(page.getByText(/(^|\D)2×5m/)).toBeVisible({ timeout: 10_000 });

  // metragem digitada manda: 20 m → 5 rolos, com atalho para voltar à soma dos difusos
  const metragem = page.getByLabel("Metragem da fita");
  await metragem.fill("20");
  await expect(page.getByText(/(^|\D)5×5m/)).toBeVisible();
  await page.getByRole("button", { name: /Usar soma dos difusos/i }).click();
  await expect(page.getByText(/(^|\D)2×5m/)).toBeVisible();

  // apagar o campo não zera a cobrança: ao sair, volta para a soma dos difusos
  await metragem.fill("");
  await metragem.blur();
  await expect(page.getByText(/(^|\D)2×5m/)).toBeVisible();
  await expect(page.getByText(/(^|\D)0×5m/)).toHaveCount(0);
});

test("driver 48V aplicado continua na tela sem módulos e pode ser removido", async ({ page }) => {
  await abrirPassoDeAmbientes(page);
  await adicionarAoAmbiente(page, TRILHO_48V);
  await adicionarModulo(page, MODULO_24W);
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page.getByText(/Driver aplicado: LM2343/i)).toBeVisible({ timeout: 10_000 });

  // remove o único módulo: a carga vai a 0, mas o driver continua cobrado — tem que aparecer
  await page
    .locator("div")
    .filter({ has: page.locator(`input[value="${MODULO_24W}"]`) })
    .last()
    .getByRole("button")
    .last()
    .click();
  await expect(page.locator(`input[value="${MODULO_24W}"]`)).toHaveCount(0);
  await expect(page.getByText(/Driver aplicado: LM2343/i)).toBeVisible();

  await page.getByRole("button", { name: /^Remover$/ }).click();
  await expect(page.getByText(/Driver aplicado/i)).toHaveCount(0);
  await expect(page.getByText(/Adicione módulos para calcular/i)).toBeVisible();
});
