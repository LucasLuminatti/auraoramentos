---
status: complete
phase: 04-drive-rls-reorganiza-o-admin
source: [04-VERIFICATION.md]
started: 2026-05-04T18:55:00Z
updated: 2026-05-06T12:25:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. RLS cross-user (ACC-01/02/03)
expected: Login como colaborador não-admin → /drive vazio (vê só o seu); login como admin (Lenny) → vê tudo. Storage policies bloqueiam acesso cruzado.
result: ✓ Validado pelo orchestrator via Playwright MCP (2026-05-06):
  - Login colab `lennywajcberg18@gmail.com` (não-admin, sem botão Admin no menu) → David: "Esta pasta está vazia" (0 pastas, 0 arquivos); Leo Shetman: idem.
  - Logout + login admin `lenny.wajcberg@luminattiled.com.br` → David mostra pasta "Smoke 04-02" + arquivo `aura-smoke-04-02.txt` (65 B).
  - Confirma policy `user_id = auth.uid() OR has_role(...,'admin')` aplicada corretamente em `cliente_arquivos` e `arquivo_pastas`.
notes: Mesmo padrão de RLS já em prod desde Phase 3 (product-images).

### 2. URL state em reload (ADM-04)
expected: Reload em `?tab=cadastros&sub=clientes` mantém sub-tab. URL legada `?tab=produtos` redireciona para `?tab=cadastros&sub=produtos` sem infinite loop.
result: ✓ Validado pelo orchestrator via Playwright MCP (Wave 3 smoke):
  - Reload em `?tab=cadastros&sub=clientes` manteve sub-tab.
  - `?tab=produtos` redirecionou para `?tab=cadastros&sub=produtos`.
  - Console 0 erros nas 5 sub-tabs.

### 3. Re-emitir PDF (ADM-01)
expected: Botão "Re-emitir PDF" em /admin/orcamento/:id baixa PDF refletindo snapshot dos ambientes.
result: ✓ Validado por Lenny (2026-05-06): PDF baixa e reflete snapshot. Funcionalmente correto.
notes: Estética do PDF está ruim — não é regressão de Phase 4 (mesmo template do Phase 1). Capturado em todo separado para fase futura de polish visual.

### 4. PrecosBatch end-to-end (ADM-02)
expected: Inline edit + save em produto → DB grava `editado_manualmente=true`.
result: ✓ Validado pelo orchestrator via Playwright MCP (Wave 4 smoke):
  - Edit LM029 preco_tabela 25.15 → 30.00 → Salvar
  - DB confirmou: `{ codigo: "LM029", preco_tabela: 30, preco_minimo: 21.22, editado_manualmente: true }`
  - Reverted para 25.15 + editado_manualmente=false (smoke cleanup).

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(none — todos validados)

## Out of scope (capturado em todos)

- **PDF estética horrível** — issue pré-existente do template Phase 1, não é regressão de Phase 4. Capturado em `.planning/todos/` para polish em fase futura.
