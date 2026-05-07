# Phase 6 — WRAP-UAT (Smoke Test Marco 1)

**Created:** 2026-05-07
**Executor (manual items):** Lenny
**Executor (automated items):** Claude (via Playwright MCP)
**Environment:** produção — https://auraoramentos-kappa.vercel.app
**Closure criterion (D-10):** 0 items com `result: failed` que sejam regressão real (bug visível). Regressões cosméticas viram TODO via `/gsd-add-todo`.

---

## Precondição obrigatória — Smoke #5 (Snapshot legacy)

Smoke #5 verifica que orçamentos PRÉ-Phase 5 (sem `pdf_template_version`) ainda renderizam o PDF v1.
Antes de executar o smoke, confirmar via SQL que existe pelo menos 1 row em `orcamentos` com:
- `created_at < '2026-05-07'`
- `pdf_template_version IS NULL`

SQL de verificação (rodar no SQL Editor do Supabase):

```sql
select id, created_at, pdf_template_version
from orcamentos
where pdf_template_version is null
  and created_at < '2026-05-07'
order by created_at desc
limit 5;
```

Se 0 rows: criar 1 manualmente via PATCH (SQL Editor):

```sql
update orcamentos
set pdf_template_version = null
where id = '<id-de-um-orçamento-antigo-conhecido>';
```

ID anotado: `_____________________________`

---

## Smoke #1: Signup novo  [MANUAL — Lenny]

- **Expected:** Aba anônima → solicitar acesso via fluxo de signup (CPF/telefone/setor obrigatórios) → admin aprova em `allowed_users` → novo user faz signup completo → login OK + redireciona para `/`.
- **Steps:**
  1. Abrir aba anônima em https://auraoramentos-kappa.vercel.app
  2. Solicitar acesso (`request-access` flow) com email novo
  3. Em outra aba (admin logado), aprovar o email em `allowed_users`
  4. Voltar para aba anônima → /auth → preencher email + senha forte (8+ chars, maiúscula, minúscula, número, especial) + CPF válido + telefone BR + setor (escolher um dos 4 enums)
  5. Confirmar email se Resend exigir (verificar inbox)
  6. Login → redireciona para `/`
- **Result:** [pending]
- **Notes:**

---

## Smoke #2: Cliente novo com arquiteto  [AUTO — Playwright]

- **Expected:** Form de criar cliente aceita Contato + CPF/CNPJ + Arquiteto via autocomplete (Phase 2). Cliente salva, aparece na lista com arquiteto vinculado.
- **Steps:**
  1. Login como admin (ou colaborador autorizado).
  2. Navegar `/admin?tab=cadastros&sub=clientes` → "+ Novo Cliente".
  3. Preencher: nome, email, telefone, contato, CPF, e selecionar arquiteto via autocomplete.
  4. Salvar → toast sucesso.
  5. Confirmar que cliente aparece na lista com nome do arquiteto preenchido na coluna Arquiteto.
- **Result:** [pending]
- **Notes:**

---

## Smoke #3: Orçamento completo + PDF v2  [AUTO — Playwright]

- **Expected:** Wizard 3 passos cria orçamento com 1+ ambiente, sistema com `local`, luminárias com imagem → Step3 → Gerar PDF → PDF v2 baixa OK (Playfair + Inter, sem 4 caixas, prose final formatado).
- **Steps:**
  1. Login.
  2. `/` → Step1: selecionar colaborador + tipo "Primeiro Orçamento".
  3. Step2: criar 1 ambiente, adicionar 1 sistema com Local preenchido + 1+ luminária com imagem.
  4. Step3: revisar; clicar "Gerar PDF".
  5. Confirmar download OK e abrir o PDF: tipografia Playfair+Inter, total geral redesenhado, prose final no fim, sem 4 caixas.
- **Result:** [pending]
- **Notes:**

---

## Smoke #4: PDF re-emit do orçamento de #3  [AUTO — Playwright]

- **Expected:** Abrir orçamento criado em #3 via `/admin/orcamento/:id` → "Re-emitir PDF" → sai v2 idêntico ao do Step3.
- **Steps:**
  1. Em outra aba: `/admin?tab=pedidos`.
  2. Clicar na linha do orçamento criado em #3.
  3. Em `/admin/orcamento/:id`, clicar "Re-emitir PDF".
  4. PDF baixa; comparar visualmente com o de #3 — devem ser idênticos.
- **Result:** [pending]
- **Notes:**

---

## Smoke #5: Snapshot legacy renderiza PDF v1  [AUTO — Playwright + precondição manual]

- **Expected:** Orçamento criado antes de 2026-05-07 (com `pdf_template_version IS NULL`) → "Re-emitir PDF" → sai v1 (Outfit + info-grid + total escuro + 4 caixas).
- **Precondition:** SQL acima confirmou existência (ou criou) 1 orçamento legacy. ID anotado.
- **Steps:**
  1. `/admin/orcamento/<id-legacy>`.
  2. "Re-emitir PDF".
  3. PDF baixa; abrir e confirmar visualmente: fonte Outfit, info-grid no topo, card escuro do total, 4 caixas (Prazo/Garantia/Pagamento/Observações) presentes.
- **Result:** [pending]
- **Notes:**

---

## Smoke #6: Importar CSV  [AUTO — Playwright]

- **Expected:** Admin > Preços > Importação > Produtos (CSV) ou Master → upload CSV de teste → preview mostra created/updated/erros → confirmar → produtos aparecem em `/admin?tab=cadastros&sub=produtos`.
- **Steps:**
  1. Preparar CSV de teste (2 linhas: 1 para criar, 1 com SKU existente para update). Pode usar template baixável da própria UI.
  2. `/admin?tab=precos&sub=importacao` → escolher "Produtos (CSV)".
  3. Upload do CSV.
  4. Preview: confirmar contadores OK (1 created + 1 updated, 0 erros).
  5. Confirmar import.
  6. `/admin?tab=cadastros&sub=produtos` → buscar SKU criado → presente.
- **Result:** [pending]
- **Notes:**

---

## Smoke #7: Drive isolado por colaborador  [MANUAL — Lenny]

- **Expected:** RLS Phase 4 (D-02 errata: `user_id` em vez de `colaborador_id`) garante que colaborador A não vê arquivos de colaborador B. Admin vê todos.
- **Steps:**
  1. Login como colaborador A → /drive → upload 1 arquivo "smoke-A.txt".
  2. Sair → login como colaborador B → /drive → confirmar que `smoke-A.txt` NÃO aparece.
  3. Como colaborador B, fazer upload "smoke-B.txt".
  4. Sair → login como admin → /drive → confirmar que VÊ os 2 arquivos.
  5. Limpar (deletar smoke-A e smoke-B no final).
- **Result:** [pending]
- **Notes:** Requer 2 contas distintas. Não dá para automatizar trivialmente via Playwright sem config de 2 sessions paralelas.

---

## Smoke #8: Filtros Phase 6 (FIL-01..04)  [AUTO — Playwright]

- **Expected:** Filtros funcionam isolados e combinados conforme Plans 02/03/04.
- **Steps:**
  1. `/admin?tab=cadastros&sub=clientes&arq_clientes=<uuid-arquiteto-X>` → confirmar lista mostra APENAS clientes do arquiteto X.
  2. `/admin?tab=cadastros&sub=clientes&arq_clientes=none` → confirmar lista mostra APENAS clientes sem arquiteto.
  3. `/admin?tab=cadastros&sub=produtos&arq_produtos=<uuid-arquiteto-Y>` → confirmar tabela só mostra produtos do Y; combinar com busca por código → AND-chained.
  4. `/admin?tab=pedidos&arq_pedidos=<uuid>&status_pedidos=enviado&data_de=2026-04-01&data_ate=2026-05-07` → confirmar lista bate com 4 critérios simultâneos.
  5. Em `/admin?tab=pedidos`, abrir Popover de filtros (resize <640px) → confirmar badge contador aparece quando há ao menos 1 filtro ativo, e clicar "Limpar filtros" zera URL.
  6. Bookmark de URL filtrada → abrir em nova aba → estado preservado.
  7. Empty state filtrado: usar UUID inexistente → confirmar mensagens "Nenhum X vinculado a este arquiteto" / "Nenhum pedido bate com os filtros".
- **Result:** [pending]
- **Notes:**

---

## Closure summary

- **Items passed:** _ / 8
- **Items failed:** _ / 8
- **Items pending (manual):** _
- **Regressões reais encontradas:** [listar — se vazio, "nenhuma"]
- **Cosméticos virados TODO:** [listar com `gsd-add-todo` IDs]
- **Marco 1 — fechamento:** [aprovado | bloqueado por falha em #N]

*Generated by /gsd-execute-phase 06 — Plan 05*
