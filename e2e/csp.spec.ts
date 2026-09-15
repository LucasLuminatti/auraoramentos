import { test, expect, type Page } from "@playwright/test";

/**
 * A CSP entrou em produção como `Content-Security-Policy-Report-Only` (vercel.json, auditoria de
 * segurança 2026-09-15): ela só protege de verdade quando virar `Content-Security-Policy`, e este
 * teste é o que libera a troca — percorre os fluxos que mais quebram com CSP (busca com imagens do
 * storage, realtime por websocket e geração de PDF, que usa data:/blob:) e falha se o navegador
 * reportar qualquer violação.
 *
 * Só roda contra um ambiente que sirva o header (produção); em localhost o Vite não manda header
 * nenhum e o teste é pulado.
 */

/** Mensagens que o Chromium emite para CSP, em Report-Only ou valendo. */
function coletarViolacoes(page: Page): string[] {
  const violacoes: string[] = [];
  page.on("console", (msg) => {
    const texto = msg.text();
    if (/Content Security Policy|Content-Security-Policy/i.test(texto)) violacoes.push(texto);
  });
  return violacoes;
}

async function temCsp(page: Page, url: string): Promise<boolean> {
  const resposta = await page.request.get(url);
  const headers = resposta.headers();
  return Boolean(headers["content-security-policy"] || headers["content-security-policy-report-only"]);
}

test("fluxo principal não gera violação de CSP", async ({ page, baseURL }) => {
  test.skip(!(await temCsp(page, baseURL!)), "ambiente sem header de CSP (dev local)");

  const violacoes = coletarViolacoes(page);

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

  // busca de produto: REST + imagem do bucket (img-src) + fonte (font-src)
  await page.locator('input[placeholder*="Buscar produto"]').fill("LM2029");
  await expect(page.getByRole("button", { name: /^LM2029[^0-9]/i }).first()).toBeVisible({ timeout: 15_000 });

  expect(violacoes, `violações de CSP:\n${violacoes.join("\n")}`).toEqual([]);
});

test("re-emitir PDF de um orçamento existente não gera violação de CSP", async ({ page, baseURL }) => {
  const orcamentoId = process.env.E2E_ORCAMENTO_ID;
  test.skip(!orcamentoId, "defina E2E_ORCAMENTO_ID com o id de um orçamento existente");
  test.skip(!(await temCsp(page, baseURL!)), "ambiente sem header de CSP (dev local)");

  const violacoes = coletarViolacoes(page);

  await page.goto(`/admin/orcamento/${orcamentoId}`);
  const botao = page.getByRole("button", { name: /Re-?emitir PDF/i });
  await expect(botao).toBeVisible({ timeout: 20_000 });

  // html2pdf gera o arquivo no cliente (data:/blob:) — o download prova que o fluxo terminou
  const download = page.waitForEvent("download", { timeout: 60_000 });
  await botao.click();
  await expect((await download).suggestedFilename()).toMatch(/\.pdf$/i);

  expect(violacoes, `violações de CSP:\n${violacoes.join("\n")}`).toEqual([]);
});
