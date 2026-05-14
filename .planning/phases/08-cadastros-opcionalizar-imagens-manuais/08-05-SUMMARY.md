---
phase: 08-cadastros-opcionalizar-imagens-manuais
plan: 05
status: complete
requirements: [FORM-01, FORM-02, FORM-03, FORM-04]
key-files:
  modified:
    - src/components/ArquitetoDialog.tsx
    - src/components/ClienteDialog.tsx
  created:
    - .planning/phases/08-cadastros-opcionalizar-imagens-manuais/SMOKE-RESULTS.md
    - .planning/phases/08-cadastros-opcionalizar-imagens-manuais/08-05-SUMMARY.md
---

# Plan 08-05 — SUMMARY

## O que foi feito

**1. ArquitetoDialog expandido (FORM-02 UI)** — commit `967ff28`. Diff 101 → 205 linhas:
- 7 useState novos: `dataNascimento`, `endereco`, `banco`, `agencia`, `conta`, `tipoConta`, `pix`
- `ArquitetoRow` interface estendida com 7 campos `string | null`
- `useEffect` hidrata os 9 campos em edit mode (`?? ""`)
- Payload com `trim() || null` em text fields, `dataNascimento || null` em date
- JSX: Data Nascimento (type=date) → Endereço (Textarea rows=2) → divider "Dados Bancários" → grid 2-col com Banco/Agência/Conta/Tipo/Pix
- DialogContent: `sm:max-w-2xl max-h-[90vh] overflow-y-auto`
- 9 ocorrências inline `<span>(opcional)</span>` (literal-count gate)
- IDs: `arq-data-nascimento`, `arq-endereco`, `arq-banco`, `arq-agencia`, `arq-conta`, `arq-tipo-conta`, `arq-pix`

**2. Hotfix user_id (Phase 7 regression)** — commit `71d28d7`. 14 linhas em 2 arquivos:
- `ClienteDialog.tsx:79-87` e `ArquitetoDialog.tsx:78-86`: `supabase.auth.getUser()` + injeção `user_id` no insert
- Guard de sessão expirada (`toast.error + return`)
- Edit path intocado (user_id imutável após criação)

**3. Smoke prod 5/5 PASS** — ver [SMOKE-RESULTS.md](./SMOKE-RESULTS.md). Bundle `EXXbaYnT` em prod. Dados de teste limpos pós-validação.

## Gate (Plan 08-05)

- [x] 7 campos opcionais no ArquitetoDialog renderizados com label + `(opcional)` hint
- [x] Insert + Update payload usa snake_case com `|| null` (não `""`)
- [x] Edit mode hidrata os 9 campos via `?? ""`
- [x] Modal scrollable (`max-h-[90vh] overflow-y-auto`)
- [x] Smoke prod cobrindo FORM-01..04 (4 UI checks + 1 SQL)
- [x] Dados de smoke limpos pós-validação

## Desvios

- **Hotfix P0 user_id encontrado durante smoke** (fora do escopo original do plan). Phase 7 deixou `arquitetos.user_id` e `clientes.user_id` NOT NULL sem default. Toda criação 400. Decisão: fixar no escopo de Phase 8 porque smoke da Phase 8 não poderia passar sem ele. Padrão usado é o mesmo já validado em Drive/Exception (commit `71d28d7`). Detalhes completos em [SMOKE-RESULTS.md](./SMOKE-RESULTS.md#bug-encontrado-e-fixado-durante-o-smoke).
- **Smoke automatizado via Playwright + MCP, não manual** — Lenny pediu "enquanto vc testar os ui vc termina a phase 8". Playwright cobriu 4 fluxos UI + 1 query SQL via Supabase MCP. Sem intervenção humana. Validação equivalente ao smoke manual planejado.

## Próximo passo

Phase 8 fechada. Próximas phases v1.1 desbloqueadas:

- **Phase 9 (Multi-tenancy RLS)** — `user_id` em arquitetos/clientes já populado (smoke), RLS policies + queries
- **Phase 10 (Wizard edição + status + descrição rica)** — independente, pode rodar em paralelo
- **Phase 11 (PDF v2 + Dashboard)** — depende de Phase 10 (status)
- **Phase 12 (Aniversário)** — depende de Phase 9 (user_id resolvendo "dono")
- **Phase 13 (Smoke closure)** — depende de 8/9/10/11/12

> **Follow-up housekeeping** (não-bloqueante): arquivo órfão `produtos-imagens/LM029.png` deixado pelo smoke FORM-04 — limpar junto com o bucket singular `produto-imagens` já listado em pending cleanup.
