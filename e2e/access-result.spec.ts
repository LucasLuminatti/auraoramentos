import { test, expect } from "@playwright/test";

/**
 * Página /access-result — renderiza o resultado da aprovação de acesso a partir
 * do query param ?status=. Foi a correção do bug "HTML cru no Chrome": a edge
 * function agora redireciona 302 pra cá em vez de devolver HTML. Aqui validamos
 * que cada status mostra o card certo (SPA, não HTML cru).
 */
const CASES: { status: string; title: RegExp }[] = [
  { status: "approved", title: /Acesso aprovado/i },
  { status: "rejected", title: /Pedido recusado/i },
  { status: "expired", title: /Link expirado/i },
  { status: "invalid", title: /Link inválido/i },
  { status: "not-found", title: /Pedido não encontrado/i },
  { status: "already-approved", title: /Pedido já revisado/i },
  { status: "already-rejected", title: /Pedido já revisado/i },
  { status: "error", title: /Erro interno/i },
];

for (const c of CASES) {
  test(`access-result mostra "${c.status}"`, async ({ page }) => {
    await page.goto(`/access-result?status=${c.status}&name=Teste&email=teste@example.com`);
    await expect(page.getByRole("heading", { name: c.title })).toBeVisible();
    // botão de voltar sempre presente — confirma que é o card SPA, não HTML cru
    await expect(page.getByRole("button", { name: /Voltar para o login/i })).toBeVisible();
  });
}

test("access-result com status inválido cai no fallback de erro", async ({ page }) => {
  await page.goto("/access-result?status=lixo-aleatorio-123");
  await expect(page.getByRole("heading", { name: /Erro interno/i })).toBeVisible();
});

test("approved exibe nome e email passados", async ({ page }) => {
  await page.goto("/access-result?status=approved&name=Fulano%20Teste&email=fulano@example.com");
  await expect(page.getByText("Fulano Teste")).toBeVisible();
  await expect(page.getByText("fulano@example.com")).toBeVisible();
});
