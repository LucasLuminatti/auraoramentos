# MILESTONES — AURA

> Índice de marcos shipped. Cada entry linka para o ROADMAP + REQUIREMENTS arquivado.

## Shipped

### v1.2 — Correções UAT + UX do Wizard de Sistemas de Iluminação

- **Window:** 2026-06-10 → 2026-06-12 (3 dias)
- **Phases:** 14 (Catálogo & Dados), 15 (Tensão & Validação), 16 (Cálculo & Metragem), 17 (Resumo & Apresentação), 18 (UX Transversal)
- **Plans:** 16 total (3 + 2 + 3 + 4 + 4)
- **Requirements outcome:** 18 DELIVERED · 0 deviation · 0 deferred (100%) — em 6 categorias (CAT, TENS/SIST, UX, CALC, RES)
- **Migrations:** 2 aditivas (zero destrutivas) — `tipo_produto_correcao_catalogos` (401 perfis + 18 fitas), `sync_passadas_padrao`
- **Edge functions:** 0 novas (PDF e cálculo client-side)
- **Audit:** status `tech_debt` — 18/18 satisfeitos, build verde, 128 testes verdes, integração cross-phase limpa, 0 blockers. [v1.2-MILESTONE-AUDIT.md](v1.2-MILESTONE-AUDIT.md)
- **Highlights:**
  - Catálogo corrigido — 401 perfis + 18 fitas que sumiam dos seletores (`tipo_produto` null/errado) corrigidos em PROD; dica MAGNETO 48V validada (CAT-01/02)
  - Validação de tensão — voltagem do driver inferida da fita, pré-filtro + aviso de divergência não-bloqueante, grouping por (código+voltagem), advisory TINY 24V, driver sugerido como default (TENS-01/02, SIST-04, UX-02)
  - Cálculo/metragem — gate contra fita 0m silenciosa, sufixo de metragem automático na descrição, passadas editáveis por família + migration de sync (CALC-01/02/03)
  - Resumo coerente — chips de LOCAL por fita (tela + PDF v2 com foto), fita sem duplicação, drivers por ambiente, advisory de itens incompletos (RES-01/02/03/05)
  - UX transversal — redirect ao buscar categoria errada, microcopy inline, Duplicar sistema + Duplicar ambiente (novos UUIDs), checklist pré-PDF com gate no botão Gerar PDF (UX-01/03/04/05, RES-04)
- **Tech debt aceito (rastreado no audit):** WR-01 (passadas travadas em [1] para 160 produtos de famílias sem regra; fix 1 linha `produto.passadas ?? 3`), advisory TINY fora do checklist pré-PDF (LOW), tag `<\strong>` cosmética em Step3Revisao, 3 warnings de code review Phase 18, 11 itens de UAT visual pendentes (Marco 1)
- **Validação:** e2e/catalogo.spec.ts 3/3 contra PROD + Playwright E2E Phase 18 (0 erros console) + 128 unit tests verdes + build verde
- **Escopo movido p/ v1.3:** montagem de sistemas compostos MAGNETO/TINY/MODULAR (SIST-01/02/03 — comentários UAT 8, 9, 11 e parte do 10)
- **Archive:** [v1.2-ROADMAP.md](v1.2-ROADMAP.md) · [v1.2-REQUIREMENTS.md](v1.2-REQUIREMENTS.md) · [v1.2-MILESTONE-AUDIT.md](v1.2-MILESTONE-AUDIT.md)

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

| Métrica | v1.0 | v1.1 | v1.2 | Total |
|---------|------|------|------|-------|
| Phases | 6 | 7 | 5 | 18 |
| Plans | 28 | 29 | 16 | 73 |
| Commits | 163 | 96 | 89 | 348 |
| Migrations | 9 | 11 | 2 | 22 (todas aditivas) |
| Edge functions live | 4 | 5 (+1 aniversario-clientes) | 5 (+0) | 5 |
| Requirements entregues | 40 | 17 + 1 deviation | 18 | 75 + 1 deviation |
| Requirements obsoletos | 1 (PROD-02) | 0 | 0 | 1 |
| Requirements deferidos | 1 (IMP-02) | 0 | 0 | 1 |

## Next milestone

**v1.3 — Sistemas Compostos (MAGNETO / TINY / MODULAR)** é o candidato principal (movido da v1.2 por ser evolução estrutural):
- **SIST-01/02/03** — montagem de MAGNETO 48V, TINY MAGNETO 24V e SYSTEM MOLD (módulos + driver dimensionado + componentes obrigatórios)
- **Decisão de arquitetura pendente:** compostos em `sistemas[]` vs `luminarias[].composicao?` (pesquisa recomenda o 2º) — resolver no início
- **PDF v3** com seção rica de compostos

Outros candidatos na fila:
- **PDF vetorial** (Backlog 999.1, prioridade alta) — substituir rasterização html2canvas
- **Preços via CSV** (IMP-02 deferido v1.0) + tabela de custos (desbloqueia margem)
- **Margem no pedido** + **documentação/testes das fórmulas de cálculo** (Marco 3)
- **Tech debt do v1.2:** WR-01 (passadas famílias sem regra — fix 1 linha), advisory TINY no checklist, limpezas cosméticas
- **Follow-ups técnicos deferidos do v1.1:** SPF/DKIM/DMARC do domínio, WR-02 pg_net monitoring, dedup `toList` aniversário, bucket singular `produto-imagens` cleanup + `has_role(admin)` gate

Definir foco do próximo marco via `/gsd-new-milestone`.

---

*Last updated: 2026-06-12 — milestone v1.2 archived (18/18 DELIVERED, audit `tech_debt` com débito aceito, 3-day cycle)*
