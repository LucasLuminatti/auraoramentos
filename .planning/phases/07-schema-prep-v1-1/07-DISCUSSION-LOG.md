# Phase 7: Schema & Prep v1.1 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 07-schema-prep-v1-1
**Areas discussed:** user_id backfill + nullability, orcamentos.status enum, descrição rica em product_variants, data_nascimento + índice + smoke + organização das migrations

---

## user_id em arquitetos + clientes

### Q1 — Backfill strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Admin mais antigo (igual Drive D-02 errata) | Replica exato o padrão validado em prod no v1.0 (Drive D-04). Determinístico e auditado | ✓ |
| Deixar NULL e Phase 9 lida | ADD COLUMN UUID NULL, sem backfill. Phase 9 decide depois | |
| Mapear por colaborador que criou | Inferir owner via algum campo existente (created_by, last edit, etc.) | |

**User's choice:** Admin mais antigo (igual Drive D-02 errata)

### Q2 — Nullability final

| Option | Description | Selected |
|--------|-------------|----------|
| NOT NULL após backfill (igual Drive D-02) | ALTER COLUMN SET NOT NULL ao fim. Força owner. RLS Phase 9 simples | ✓ |
| Manter NULL | user_id opcional para sempre. Mais flexível, RLS fica com OR null/has_role | |

**User's choice:** NOT NULL após backfill

### Q3 — ON DELETE policy

| Option | Description | Selected |
|--------|-------------|----------|
| ON DELETE SET NULL + NOT NULL (igual Drive) | Padrão v1.0 — auth.user deletado vira NULL, admin recupera | |
| ON DELETE CASCADE | Auth.user deletado apaga clientes/arquitetos junto. Agressivo, perde histórico | |
| ON DELETE RESTRICT | Bloqueia delete do auth.user enquanto tiver clientes/arquitetos. Conservador | ✓ |

**User's choice:** ON DELETE RESTRICT
**Notes:** Divergência consciente vs Drive D-05 (SET NULL). Cliente/arquiteto carregam histórico de orçamentos — bloquear delete até reassignar manualmente é o comportamento correto aqui.

---

## orcamentos.status

### Q1 — Como reconciliar `fechado` (atual) com `aprovado` (spec v1.1)

| Option | Description | Selected |
|--------|-------------|----------|
| Rename fechado→aprovado (UPDATE in-place) + add pendente | UPDATE + CHECK constraint com 4 valores. Single source, mudança destrutiva no dado | ✓ |
| Manter fechado + add aprovado + pendente (5 valores) | 100% aditivo, fechado vira alias legado. Vira dívida técnica | |
| Só expandir TEXT sem CHECK | Phase 7 sem SQL — decisão vira Phase 10 | |
| Trocar para enum nativo Postgres | CREATE TYPE + ALTER COLUMN. Mais seguro, mas destrutivo | |

**User's choice:** Rename fechado→aprovado (UPDATE in-place) + add pendente

### Q2 — Default do status

| Option | Description | Selected |
|--------|-------------|----------|
| Manter DEFAULT 'rascunho' | Zero mudança no comportamento de criação | ✓ |
| DEFAULT 'pendente' | Orçamento novo já sai pendente; rascunho explícito | |
| Sem DEFAULT (app sempre passa) | Mais explícito mas pode quebrar inserts antigos | |

**User's choice:** Manter DEFAULT 'rascunho'

### Q3 — Sync do tipo TypeScript

| Option | Description | Selected |
|--------|-------------|----------|
| Só SQL; TS fica para Phase 10 | Phase 7 é schema-only. Rename TS + types.ts é Phase 10 (WIZ-04) | ✓ |
| Sincronizar TS já na Phase 7 | Rename fechado→aprovado no .ts + regen no mesmo commit. Mais limpo mas mistura camadas | |

**User's choice:** Só SQL; TS fica para Phase 10

---

## Descrição rica em product_variants

### Q1 — Storage strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Manter no JSONB atributos | Phase 10 lê atributos->>'temperatura_k' etc. Zero migration aqui | ✓ |
| Promover a typed columns | Add COLUMN temperatura_k INT, irc INT, nicho TEXT + backfill from JSONB | |
| JSONB para master; typed só para coringa | Híbrido | |

**User's choice:** Manter no JSONB atributos

### Q2 — Auditoria de cobertura (criterio #4)

| Option | Description | Selected |
|--------|-------------|----------|
| Auditoria via SQL (ler atributos no DB) | SELECT count com filtro atributos->>'temperatura_k' IS NULL etc. | ✓ |
| Auditoria via XLSX in loco | Abrir base_dados_site_2026.xlsx e cross-check com productAttributes.ts | |
| Pular auditoria — confiar no Phase 3 | Assumir cobertura por design | |

**User's choice:** Auditoria via SQL

### Q3 — Gap policy

| Option | Description | Selected |
|--------|-------------|----------|
| Registrar como FOLLOW-UP e seguir | Gap não bloqueia. SUMMARY + todo. Phase 10 já trata variant sem dado | ✓ |
| Re-rodar ImportMaster como parte da Phase 7 | Workflow manual no admin se gap > X | |
| Bloquear até 0 gaps | Phase 7 não fecha enquanto não 100%. Pode emperrar | |

**User's choice:** Registrar como FOLLOW-UP e seguir

---

## data_nascimento + smoke + migrations

### Q1 — Índice em data_nascimento

| Option | Description | Selected |
|--------|-------------|----------|
| BTREE simples em data_nascimento agora | Custo zero, Phase 12 ganha lookup rápido. Aditivo | ✓ |
| Index funcional (MONTH, DAY) agora | Otimiza predicado do cron. Premature optimization para volume atual | |
| Sem índice; Phase 12 decide | ADD COLUMN só. Seq scan em tabela pequena é OK | |

**User's choice:** BTREE simples em data_nascimento agora

### Q2 — Smoke de regressão (critério #5)

| Option | Description | Selected |
|--------|-------------|----------|
| Smoke leve via SQL + curl/Playwright | SQL counts + JOIN típico + 1 abertura Playwright | ✓ |
| Só SQL; smoke fica para Phase 13 | Phase 7 termina ao validar via psql | |
| Smoke pesado via 2 contas reais | Lenny + David criam orçamento. Phase 13 trabalho | |

**User's choice:** Smoke leve via SQL + curl/Playwright

### Q3 — Organização das migrations

| Option | Description | Selected |
|--------|-------------|----------|
| 3 migrations separadas por domínio | user_id / data_nascimento / status separadas. Padrão v1.0 | ✓ |
| 1 migration grande (transação única) | BEGIN/COMMIT atômico. Difícil revisar diff | |
| 2 migrations (RLS-prep separado) | Compromisso. user_id sozinha, resto junto | |

**User's choice:** 3 migrations separadas por domínio

---

## Claude's Discretion

- Naming exato dos índices (idx_<tabela>_<coluna>)
- Texto exato dos COMMENT
- Estrutura interna dos blocos SQL (pre-flight / ADD / backfill / NOT NULL / indexes / comments)
- Format do SUMMARY.md e PUSH-LOG.md

## Deferred Ideas

- Audit log de mudanças de status (orcamentos_status_history) — phase futura se virar compliance
- Tradução UI dos status (aprovado vs ganho, perdido vs cancelado) — Phase 10 (WIZ-04)
- Index funcional MONTH/DAY em data_nascimento — revisar em Phase 12 se profiling indicar
- Promover atributos JSONB a typed columns — revisar se Phase 10 sofrer com tipagem
