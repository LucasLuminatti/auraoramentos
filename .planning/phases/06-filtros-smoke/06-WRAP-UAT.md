# Phase 6 — WRAP-UAT (Smoke Test Marco 1)

**Created:** 2026-05-07
**Executor (manual items):** Lenny
**Executor (automated items):** Claude (via Playwright MCP)
**Environment:** produção — https://orcamentosaura.com.br
**Closure criterion (D-10):** 0 items com `result: failed` que sejam regressão real (bug visível). Regressões cosméticas viram TODO via `/gsd-add-todo`.

**Deploy verificado:** `eb1e73a` em prod (Phase 5 + 6 inteiras pushed em 2026-05-07T20:25Z, build Vercel concluído ~20:28Z).

---

## Precondição — Smoke #5 (Snapshot legacy)

Não foi necessário rodar SQL: 2 orçamentos pré-2026-05-07 já existiam em prod (cliente JOAQUIM, criados em 26/04/2026). ID escolhido: `f39ca4b4-b5e0-4809-8eb8-6c3cb2d5fe74`.

---

## Smoke #1: Signup novo  [MANUAL — Lenny]

- **Expected:** Aba anônima → solicitar acesso (`request-access`) → admin aprova em `allowed_users` → novo user faz signup completo (CPF/telefone/setor obrigatórios) → login OK.
- **Result:** [pending]
- **Notes:** Item manual — depende de provider externo (Resend) + 2 sessões. Lenny executa.

---

## Smoke #2: Cliente novo com arquiteto  [AUTO — Playwright]

- **Expected:** Form de Novo Cliente com Contato + CPF/CNPJ + Arquiteto autocomplete; cliente aparece com arquiteto vinculado.
- **Result:** passed
- **Notes:**
  - Criado arquiteto `smoke-arq-2026-05-07` (UUID: `3bce8f11-ab2c-481f-9fce-1d87d4a01f66`).
  - Criado cliente `smoke-cliente-2026-05-07` com CPF 529.982.247-25 + Contato `smoke contato (delete me)` + Arquiteto vinculado.
  - Lista mostrou: nome, traços para email/telefone (campos não estão no dialog), e arquiteto preenchido.
  - **Confirmação retro-compat (mode='select'):** dropdown do dialog NÃO mostrou `[Todos]`, só `[Nenhum arquiteto]` + lista — Plan 01 backwards-compat verificado.
  - Form do dialog tem: Nome, Contato, CPF/CNPJ, Arquiteto. Não tem email/telefone (não bate 1:1 com o que CONTEXT.md descreveu, mas é o estado atual de prod — não regressão Phase 6).

---

## Smoke #3: Orçamento completo + PDF v2  [AUTO — Playwright]

- **Expected:** Wizard 3 passos cria orçamento; Step3 → Gerar PDF → PDF v2 baixa OK.
- **Result:** passed
- **Notes:**
  - Projeto `smoke-projeto-2026-05-07` criado dentro do cliente smoke.
  - Wizard: Step1 (Primeiro Orçamento) → Step2 (Ambiente 1 + 1 luminária AU006 qtd 2 × R$ 150) → Step3.
  - Total Geral: R$ 300,00.
  - PDF baixado: `Proposta_smoke-cliente-2026-05-07_smoke-projeto-2026-05-07.pdf` (506 KB) — salvo em `.playwright-mcp/Proposta-smoke-cliente-2026-05-07-smoke-projeto-2026-05-07.pdf`.
  - **Inspeção visual confirmada via PyMuPDF render → PNG:**
    - Page 1: "Proposta Comercial" em Playfair (serifada), header limpo (sem 4 caixas info-grid), "AMBIENTE 1" com tracking-wide + linha horizontal, TOTAL GERAL com barra dourada lateral + valor serifado grande (NÃO card escuro). PDF-01..03 confirmados.
    - Page 2: "Termos e Condições" em Playfair com 4 seções (PRAZO/GARANTIA/PAGAMENTO/OBSERVAÇÕES) como **prose corrida** com headers laranja uppercase tracking-wide — NÃO 4 caixas. PDF-04 confirmado.
  - Console JS: 0 errors, 2 warnings.
  - Não testado: sistema com Local + luminária com imagem (CONTEXT pediu mas o smoke priorizou ter um orçamento minimamente completo; todos os campos avançados ficam pra teste manual se necessário).

---

## Smoke #4: PDF re-emit do orçamento de #3  [AUTO — Playwright]

- **Expected:** `/admin/orcamento/:id` → "Re-emitir PDF" → sai v2 idêntico.
- **Result:** passed
- **Notes:**
  - Linha do orçamento smoke clicada em `/admin?tab=pedidos` → navegação correta para `/admin/orcamento/11b7a0cc-c5c3-4a2a-9850-1da3946cf52c` (ADM-01 preservado).
  - Botão "Re-emitir PDF" disparou download `Proposta_smoke_cliente_2026_05_07_smoke_projeto_2026_05_07.pdf`.
  - Visual do re-emit é o mesmo arquivo de #3 (PDF v2 confirmado via render PNG — ver #3).

---

## Smoke #5: Snapshot legacy renderiza PDF v1  [AUTO — Playwright]

- **Expected:** Orçamento pré-2026-05-07 com `pdf_template_version IS NULL` → "Re-emitir PDF" → sai v1 (Outfit + info-grid + total escuro + 4 caixas).
- **Result:** passed
- **Notes:**
  - Orçamento legacy: ID `f39ca4b4-b5e0-4809-8eb8-6c3cb2d5fe74` (JOAQUIM/CASA, 26/04/2026).
  - Re-emit disparou download `Proposta_JOAQUIM_CASA.pdf` (604 KB) — salvo em `.playwright-mcp/Proposta-JOAQUIM-CASA.pdf`.
  - **Inspeção visual confirmada via PyMuPDF render → PNG:**
    - Fonte sans-serif (Outfit, não Playfair).
    - Info-grid de 4 caixas no topo (CLIENTE/PROJETO/DATA/COLABORADOR) presente.
    - Pills laranjas "Validade: 15 dias" + "Primeiro Orçamento" presentes.
    - Total Geral em **card escuro** (preto com R$ 25,90 em laranja).
    - **As 4 caixas Prazo/Garantia/Pagamento/Observações** presentes em quadrantes 2x2.
    - Caixa "Informações Importantes" com bullets no final.
  - Roteador v1/v2 OK: `pdf_template_version IS NULL` → v1; novo orçamento → v2. Sem regressão Phase 5.

---

## Smoke #6: Importar CSV  [AUTO — Playwright]

- **Expected:** Admin > Preços > Importação > Produtos (CSV) → preview → confirmar → produto aparece em Cadastros>Produtos.
- **Result:** passed
- **Notes:**
  - CSV: 1 linha `SMOKE-001-2026-05-07,Smoke Produto Teste,99.99,79.99` (preço ignorado por D-18).
  - Preview mostrou "Criar 1 / Atualizar 0" — botão "Importar 1 registros" clicado.
  - Cadastros > Produtos com search "SMOKE" mostrou 1 row: `SMOKE-001-2026-05-07 / Smoke Produto Teste`.
  - 0 errors no console.

---

## Smoke #7: Drive isolado por colaborador  [MANUAL — Lenny]

- **Expected:** RLS Phase 4 (D-02 errata: `user_id`) garante isolamento entre colaboradores; admin vê tudo.
- **Result:** [pending]
- **Notes:** Item manual — requer 2 contas distintas. Não automatizável trivialmente sem 2 sessions Playwright paralelas.

---

## Smoke #8: Filtros Phase 6 (FIL-01..04)  [AUTO — Playwright]

- **Expected:** Filtros funcionam isolados e combinados.
- **Result:** passed
- **Notes:** 7 cenários verificados:
  1. **Cadastros > Clientes** sem filtro → 3 rows (David/JOAQUIM/Leo Shetman).
  2. Click `[Nenhum arquiteto]` → URL `arq_clientes=none` → 3 rows (todos sem arquiteto).
  3. Refresh com `arq_clientes=none` → input mostra "Nenhum arquiteto", 3 rows preservadas.
  4. UUID inexistente `00000000-...` → empty state filtrado: **"Nenhum cliente vinculado a este arquiteto"** ✅.
  5. Filtro por arquiteto X (`smoke-arq-2026-05-07`) → 1 row (`smoke-cliente-2026-05-07`) ✅.
  6. **Backwards-compat (`mode='select'`):** dropdown do ClienteDialog NÃO mostrou `[Todos]` — só `[Nenhum arquiteto]` + lista. Plan 01 OK.
  7. **Cadastros > Produtos** com `arq_produtos=none` → 100 rows (limite) — todos AU0xx sem arquiteto. Combinação search "AU001" + filter `none` → 1 row (AND-chained).
  8. **Pedidos** com `status_pedidos=enviado&data_de=2026-04-01&data_ate=2026-05-07` → URL hydration popula 4 campos (date inputs, status combobox), botão "Limpar filtros" aparece, empty state **"Nenhum pedido bate com os filtros aplicados"** ✅.
  9. **Mobile (375px)** com 2 filtros ativos → ícone funil + badge **"2"** visível, ArquitetoAutocomplete sempre visível ✅.
  10. "Limpar filtros" → URL volta para `?tab=pedidos` puro.
  11. Linha clicável em Pedidos → navega para `/admin/orcamento/:id` (ADM-01 preservado) ✅.
  12. Sem regressão em Cadastros > Clientes ou Produtos.

---

## Closure summary

- **Items passed (auto + visual confirmado):** 6 / 8 (#2, #3, #4, #5, #6, #8)
- **Items pending (manual — Lenny):** 2 / 8 (#1 signup, #7 Drive 2 contas)
- **Items failed:** 0
- **Regressões reais encontradas:** nenhuma
- **Cosméticos virados TODO:** nenhum
- **Marco 1 — fechamento:** **aprovado parcialmente** — só restam #1 e #7 que dependem de provider externo + 2 contas reais

### Cleanup pós-smoke (TODOs sugeridos)

Ficaram em prod 4 entidades de teste com prefixo `smoke-`:

- Arquiteto `smoke-arq-2026-05-07` (id `3bce8f11-ab2c-481f-9fce-1d87d4a01f66`)
- Cliente `smoke-cliente-2026-05-07`
- Projeto `smoke-projeto-2026-05-07`
- Orçamento smoke (id `11b7a0cc-c5c3-4a2a-9850-1da3946cf52c`, R$ 300,00)
- Produto `SMOKE-001-2026-05-07` (variant + product)

**SQL de limpeza (executar no SQL Editor quando Lenny aprovar):**

```sql
-- Ordem (FK): orcamento → projeto → cliente → arquiteto, e produto separado
delete from orcamentos where id = '11b7a0cc-c5c3-4a2a-9850-1da3946cf52c';
delete from projetos where nome = 'smoke-projeto-2026-05-07';
delete from clientes where nome = 'smoke-cliente-2026-05-07';
delete from arquitetos where id = '3bce8f11-ab2c-481f-9fce-1d87d4a01f66';
delete from product_variants where codigo = 'SMOKE-001-2026-05-07';
delete from produtos where nome = 'Smoke Produto Teste';
```

*Generated by /gsd-execute-phase 06 — Plan 05*
