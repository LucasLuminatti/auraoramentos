import { test, expect, type Page } from "@playwright/test";

/**
 * Cadastro com "Confirm email" ligado (2026-09-16). Sem sessão no retorno do signUp, a edge
 * `create-colaborador` recusaria a chamada (só aceita o usuário do token): os dados do
 * cadastro vão para user_metadata e o perfil nasce no primeiro login.
 *
 * NADA chega ao servidor: a checagem do e-mail e o signup são interceptados — nenhuma conta é
 * criada em produção.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const EMAIL = "vendedor-teste@example.com";
const SENHA = "Senha-Forte-123!";

async function preencherCadastro(page: Page) {
  await page.goto("/auth?mode=signup");
  await page.locator("#nome").fill("Vendedor Teste");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#confirmEmail").fill(EMAIL);
  await page.locator("#cpf").fill("52998224725"); // CPF válido de exemplo
  await page.locator("#telefone").fill("11987654321");
  await page.locator("#setor").click();
  await page.getByRole("option", { name: "Comercial" }).click();
  await page.locator("#cargo").fill("Consultor");
  await page.locator("#departamento").fill("Vendas");
  await page.locator("#password").fill(SENHA);
  await page.locator("#confirmPassword").fill(SENHA);
}

test("cadastro com confirmação de e-mail: guarda os dados na conta e não chama create-colaborador", async ({ page }) => {
  await page.route("**/rest/v1/rpc/email_autorizado", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "true" })
  );

  let corpoSignup: Record<string, unknown> | null = null;
  await page.route("**/auth/v1/signup**", async (route) => {
    corpoSignup = route.request().postDataJSON();
    // resposta do GoTrue com confirmação pendente: usuário sem sessão
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "00000000-0000-0000-0000-000000000000",
        aud: "authenticated",
        role: "",
        email: EMAIL,
        confirmation_sent_at: new Date().toISOString(),
        user_metadata: {},
        app_metadata: { provider: "email", providers: ["email"] },
        identities: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
  });

  let chamouCreateColaborador = false;
  await page.route("**/functions/v1/create-colaborador", (route) => {
    chamouCreateColaborador = true;
    return route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"Não autenticado"}' });
  });

  await preencherCadastro(page);
  await page.getByRole("button", { name: /Cadastrar|Criar conta/i }).click();

  await expect(page.getByText(/Enviamos um link de confirmação/i)).toBeVisible({ timeout: 10_000 });
  expect(chamouCreateColaborador).toBe(false);
  expect(corpoSignup).not.toBeNull();
  const dados = (corpoSignup as unknown as { data?: Record<string, unknown> }).data ?? {};
  expect(dados).toMatchObject({
    nome: "Vendedor Teste",
    cargo: "Consultor",
    departamento: "Vendas",
    setor: "comercial",
  });
  // CPF e telefone não vão para o token de login
  expect(JSON.stringify(dados)).not.toMatch(/52998224725|11987654321/);
});

test("cadastro com e-mail não autorizado vai para a solicitação de acesso sem chamar o signup", async ({ page }) => {
  await page.route("**/rest/v1/rpc/email_autorizado", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "false" })
  );
  let chamouSignup = false;
  await page.route("**/auth/v1/signup**", (route) => {
    chamouSignup = true;
    return route.abort();
  });

  await preencherCadastro(page);
  await page.getByRole("button", { name: /Cadastrar|Criar conta/i }).click();

  await expect(page).toHaveURL(/request-access/, { timeout: 10_000 });
  expect(chamouSignup).toBe(false);
});
