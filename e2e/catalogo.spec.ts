import { test, expect, type Page } from "@playwright/test";
import { snapshotOrcamentoIds, deleteOrcamentoDeTeste } from "./helpers/supabaseAdmin";

/**
 * Phase 14 (CAT-01 / CAT-02): valida contra PROD que a migration 20260610000001
 * surtiu efeito — as famílias antes invisíveis (tipo_produto null) aparecem nos
 * seletores corretos, e a dica do MAGNETO 48V está certa (não confunde com TINY).
 *
 * Estes testes ficam no Step 2 do wizard. A persistência de orçamento só acontece
 * no Step 3 (Step3Revisao.tsx), então NENHUM rascunho é gravado em PROD aqui.
 * O afterEach é defensivo: snapshot + apaga só rascunho NOVO da janela, se surgir.
 */

// Famílias corrigidas para 'perfil' (descrição começa com PERFIL) — UAT: WALL WASHER, CANTONEIRA, NANO
const PERFIS = [
  { codigo: "LM3475", fam: "WALL WASHER" },
  { codigo: "LM982", fam: "CANTONEIRA" },
  { codigo: "LM3291", fam: "NANO" },
];
// Família corrigida para 'fita' — rolo de fita real (FITA LED ULTRA POWER)
const FITA = { codigo: "LM3825" };
// MAGNETO 48V (tipo null → seletor luminária; sistema='magneto_48v' → toast 48V)
const MAGNETO = { codigo: "LM2331" }; // TRILHO DE SOBREPOR MAGNETICO PT 1M - MAX. 48V

const TIPO = "Primeiro Orçamento";
let janelaInicio: string;
let idsAntes: Set<string>;

test.beforeEach(async () => {
  janelaInicio = new Date(Date.now() - 120_000).toISOString();
  idsAntes = await snapshotOrcamentoIds();
});

test.afterEach(async () => {
  // O teste fica no Step 2 (persistência só no Step 3), então nada é gravado.
  // Chamada única defensiva: apaga só rascunho NOVO da janela, se por algum motivo surgir.
  const total = await deleteOrcamentoDeTeste(idsAntes, janelaInicio, { tipo: TIPO, valor: 0, status: "rascunho" });
  expect(total, "cleanup não deve apagar mais de 1 linha").toBeLessThanOrEqual(1);
});

/** Navega até o Step 2 com um ambiente adicionado (cliente/projeto existentes em PROD). */
async function gotoStep2ComAmbiente(page: Page) {
  await page.goto("/");
  await expect(page.getByText(/Clientes/i).first()).toBeVisible({ timeout: 20_000 });
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
  await expect(page.getByRole("heading", { name: /Ambientes e Itens/i })).toBeVisible();
  await page.getByRole("button", { name: /Adicionar Ambiente/i }).click();
}

test("CAT-01: WALL WASHER, CANTONEIRA, NANO aparecem no seletor de PERFIL e a fita no seletor de FITA", async ({ page }) => {
  await gotoStep2ComAmbiente(page);

  // abre a aba de Sistemas e cria um sistema
  await page.getByRole("tab", { name: /Sistemas de Iluminação/i }).click();
  await page.getByRole("button", { name: /Novo Sistema/i }).click();

  // revela o seletor de perfil (é opcional, atrás de "Vincular Perfil")
  await page.getByRole("button", { name: /Vincular Perfil/i }).click();

  // cada família corrigida deve aparecer como opção no seletor de perfil
  const perfilBox = page.getByRole("textbox", { name: /Código do perfil/i }).first();
  for (const p of PERFIS) {
    await perfilBox.fill("");
    await perfilBox.fill(p.codigo);
    await expect(
      page.getByRole("button", { name: new RegExp(`^${p.codigo}\\b`, "i") }).first(),
      `${p.codigo} (${p.fam}) deve aparecer no seletor de perfil`,
    ).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape"); // fecha o dropdown sem selecionar
  }

  // fita corrigida deve aparecer no seletor de fita
  const fitaBox = page.getByRole("textbox", { name: /Código da fita/i }).first();
  await fitaBox.fill(FITA.codigo);
  await expect(
    page.getByRole("button", { name: new RegExp(`^${FITA.codigo}\\b`, "i") }).first(),
    `${FITA.codigo} deve aparecer no seletor de fita`,
  ).toBeVisible({ timeout: 15_000 });
});

test("CAT-02: ao adicionar MAGNETO 48V, a dica descreve o MAGNETO (48V), não o TINY (24V)", async ({ page }) => {
  await gotoStep2ComAmbiente(page);

  // MAGNETO 48V tem tipo_produto null → aparece no seletor de luminária
  await page.getByRole("button", { name: /Adicionar Luminária/i }).click();
  await page.getByRole("textbox", { name: /Código do item/i }).first().fill(MAGNETO.codigo);
  const opt = page.getByRole("button", { name: new RegExp(`^${MAGNETO.codigo}\\b`, "i") });
  await expect(opt.first()).toBeVisible({ timeout: 15_000 });
  await opt.first().click();

  // toast correto: "Trilho magnético 48V" (frase exclusiva do toast — a descrição do produto é "MAGNETICO ... 48V")
  await expect(page.getByText(/Trilho magnético 48V/i).first()).toBeVisible({ timeout: 8_000 });
  // e NÃO o toast do TINY (24V)
  await expect(page.getByText(/Tiny Mag/i)).toHaveCount(0);
});
