# MILESTONES — AURA

> Índice de marcos shipped. Cada entry linka para o ROADMAP + REQUIREMENTS arquivado.

## Shipped

### v1.1 — Polimento UAT + Multi-tenancy + Automação

- **Window:** 2026-05-11 → 2026-05-15 (5 dias)
- **Phases:** 7 (Schema & Prep), 8 (Cadastros), 9 (RLS), 10 (Wizard), 11 (PDF + Dashboard), 12 (Aniversário), 13 (Closure)
- **Plans:** 29 total (4 + 5 + 7 + 5 + 3 + 3 + 2)
- **Commits:** 96 (window 2026-05-11..HEAD)
- **Requirements outcome:** 17 DELIVERED · 1 DELIVERED with deviation (AUTO-02 — multi-admin via `has_role(admin)`) · 0 DEFERRED
- **Migrations:** 11 aditivas (zero destrutivas) — user_id em arquitetos/clientes (Phase 7), data_nascimento (Phase 7), orcamentos.status (Phase 7), arquitetos.expand_fields (Phase 8), RLS policies (Phase 9), aniversario_envios + cron schedule (Phase 12)
- **Edge functions:** 1 nova — `aniversario-clientes` (Deno + Resend, cron-triggered)
- **Extensions:** pg_cron 1.6.4 + pg_net 0.20.0 habilitados (Phase 12)
- **Highlights:**
  - Multi-tenancy RLS em `arquitetos` + `clientes` replicando padrão Drive D-02 (zero-code-change no client; preflight 11 callsites = 0 Risk)
  - Automação aniversário D-5 via pg_cron + Resend (primeira automação assíncrona do AURA; multi-admin dinâmico via has_role)
  - Wizard editável (preço com floor mínimo, qtd recalcula, status pós-PDF, reabrir rascunho)
  - Descrição rica de produto (`construirDescricaoRica` puxa temp/pot/IRC/nicho da ImportMaster)
  - PDF v2 sem bloco vazio + prazo "20 dias úteis"
  - Dashboard com card único "Orçamentos em Aberto" substitui 6 cards de métrica
  - Cadastros opcionalizados (cliente sem Contato/CPF/Arquiteto + arquiteto expandido + AU001..16 editáveis)
- **Bugs críticos:** 1 capturado e fixed inline durante smoke (BUG-13-01 — ClienteDialog faltava campo `data_nascimento`, commit `b3ae4db`)
- **Smoke prod:** 4/4 cenários integration PASS (cliente+aniversário pipeline, orçamento full flow, RLS cross-feature, trigger manual edge fn)
- **Follow-ups deferidos pra v1.2+:** WR-02 pg_net monitoring, SPF/DKIM domínio, dedup `toList` aniversário, IMP-02 preço CSV (carryover v1.0), refatoração fórmulas, margem, docs+testes, bucket singular cleanup
- **Archive:** [v1.1-ROADMAP.md](v1.1-ROADMAP.md) · [v1.1-REQUIREMENTS.md](v1.1-REQUIREMENTS.md)

### v1.0 — Melhorias v1

- **Window:** 2026-04-23 → 2026-05-07 (15 dias)
- **Phases:** 6 (Schema & Prep, Cadastros & Arquiteto CRUD, Produtos & Importação, Drive RLS & Reorg Admin, PDF Redesign, Filtros & Smoke)
- **Plans:** 28 total
- **Commits:** 163
- **Diff:** 259 arquivos · +35.447 / −3.610 LOC
- **Requirements outcome:** 40 DELIVERED · 1 OBSOLETE (PROD-02 — DB tinha 0 produtos sem desc/preço) · 1 DEFERRED (IMP-02 — preço por CSV)
- **Migrations:** 9 aditivas (zero destrutivas)
- **Edge functions:** 4 — create-colaborador, import-produtos, request-access, review-access
- **Highlights:**
  - Arquiteto como entidade própria com FK em `clientes` + `produtos` + CRUD admin + filtros em 3 listas
  - Importação CSV de produtos + ImportMaster XLSX one-shot (2.088 variants oficiais)
  - Drive RLS por `user_id` + bucket privado + signed URLs (validado em prod com 2 contas reais)
  - PDF redesign v2 (Playfair + Inter) com router v1/v2 retro-compatível
  - Admin reorganizado em 5 sub-tabs com URL state
  - Filtros combináveis por arquiteto/cliente/período/status em Pedidos
- **Smoke prod:** 8/8 itens passed (2026-05-07)
- **Archive:** [v1.0-ROADMAP.md](v1.0-ROADMAP.md) · [v1.0-REQUIREMENTS.md](v1.0-REQUIREMENTS.md)

## Stats acumulados

| Métrica | v1.0 | v1.1 | Total |
|---------|------|------|-------|
| Phases | 6 | 7 | 13 |
| Plans | 28 | 29 | 57 |
| Commits | 163 | 96 | 259 |
| Migrations | 9 | 11 | 20 (todas aditivas) |
| Edge functions live | 4 | 5 (+1 aniversario-clientes) | 5 |
| Requirements entregues | 40 | 17 + 1 deviation | 57 + 1 deviation |
| Requirements obsoletos | 1 (PROD-02) | 0 | 1 |
| Requirements deferidos | 1 (IMP-02) | 0 | 1 |

## Next milestone

v1.2+ — TBD. Candidatos provisórios (PROJECT.md):
- **Preços via CSV** (IMP-02 deferido v1.0) + tabela de custos (desbloqueia margem)
- **Margem no pedido** — agregada por arquiteto/colaborador/período
- **Documentação + testes das fórmulas de cálculo** (fita/driver/perfil/agrupamento)
- **Follow-ups técnicos deferidos do v1.1:**
  - SPF/DKIM/DMARC do domínio `orcamentosaura.com.br` (email Junk no Outlook)
  - WR-02 pg_net 4xx/5xx monitoring/alerts pro cron aniversário
  - Dedup `toList` na edge fn aniversário (owner=admin)
  - Bucket singular `produto-imagens` cleanup + `has_role(admin)` gate explícito em edge fn

Definir foco do próximo marco via `/gsd-new-milestone`.

---

*Last updated: 2026-05-15 — milestone v1.1 archived (17 DELIVERED + 1 DELIVERED with deviation, 5-day cycle)*
