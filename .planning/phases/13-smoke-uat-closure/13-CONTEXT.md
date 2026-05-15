---
phase: 13-smoke-uat-closure
type: context
status: ready_for_planning
date: 2026-05-15
milestone: v1.1
---

# Phase 13 — Smoke & UAT Closure (CONTEXT)

## Domain boundary

Fim do marco v1.1: validação cruzada de prod das phases 8-12 entregues, captura de bugs encontrados, e arquivamento formal do milestone.

**Não é:** re-validação completa de cada phase isoladamente (cada uma já tem seu smoke específico PASS). É **integration test** dos fluxos que cruzam múltiplas features.

## Carrying forward (decisões locked das phases anteriores)

- v1.0 closure pattern (Phase 6) usado como referência — outcome + archive em `.planning/milestones/v1.1-*.md`
- Cada phase já tem smoke próprio:
  - Phase 8: FORM-01..04 (5/5 PASS, hotfix user_id Phase 7 regression)
  - Phase 9: RLS bilateral (5/5 PASS hoje 2026-05-15)
  - Phase 10: wizard edição (já SUMMARY existe)
  - Phase 11: PDF v2 + dashboard (4/4 PASS)
  - Phase 12: aniversário automation E2E (smoke + Outlook screenshot)

Phase 13 **não duplica** esses smokes — foca em integration.

## Decisões (CONTEXT-D-XX)

### D-01: Smoke depth = integration only

Apenas fluxos cross-feature que exercitam combinação de phases. Não re-rodar smokes individuais.

**Cenários de integration mínimos** (a refinar em PLAN):
- Criar cliente novo COM data_nascimento (Phase 7+8) → aparece pra colab dono via RLS (Phase 9) → cliente entra no `buscar_aniversariantes_d5` se D+5 (Phase 12)
- Montar orçamento full: novo cliente + arquiteto expandido (Phase 8) → wizard editando preço/qtd com status (Phase 10) → PDF v2 sem bloco vazio + prazo (Phase 11) → entra no dashboard "Em Aberto" (Phase 11)
- 2 colabs vendo orçamentos isolados (Phase 9 × Phase 10): colab A cria orçamento → colab B não vê → admin vê ambos
- Trigger manual da edge fn aniversário com cliente teste + cleanup (Phase 12)

### D-02: Bug threshold = zero crítico + follow-ups OK

**Crítico (bloqueia fechamento):**
- Data corruption (perda de orçamento, cliente, configuração)
- RLS leak (colab A vê dado de colab B)
- App crash / 500 reproduzível em fluxo principal
- PDF gerando em branco ou com dados errados

**Não-crítico (vai pra backlog v1.2+):**
- UI papercut, espaçamento, copy
- Deliverability (já documentado: spam Outlook)
- Edge case raro com workaround conhecido
- Quality-of-life que não afeta entrega

### D-03: Plan breakdown = 2 plans

- **13-01: Integration Smoke + Bug Capture** — executa os cenários cross-feature, escreve BUGS.md. Se algum bug crítico aparecer, bloqueia 13-02 até resolver (criar phase 13.1 ou fix inline depende do caso).
- **13-02: Milestone Archive** — atualiza ROADMAP/REQUIREMENTS outcome, arquiva em `.planning/milestones/v1.1-*.md`, atualiza `.planning/milestones/MILESTONES.md` index.

13-02 depende de 13-01 (sem smoke PASS não fecha marco).

### D-04: Executor = Playwright + Lenny visual confirmation

Claude dirige via Playwright MCP, Lenny acompanha a tela e confirma percepções visuais (PDF render, layout do dashboard, comportamento de edição). Mix de automação determinística (cliques, queries SQL cross-check) + olho humano (estética, fluxo natural).

Para o aniversário (Phase 12), Lenny também confirma 1 inbox (se quisermos validar email real). Alternativa: confirmar via `aniversario_envios.status='sent'` e pular inbox.

### D-05: Bug tracking = .planning/phases/13.../BUGS.md

Tabela markdown:

```markdown
| ID | Severidade | Cenário | Comportamento atual | Esperado | Status |
|----|------------|---------|---------------------|----------|--------|
| BUG-13-01 | critical | ... | ... | ... | fix-now / deferred-v1.2 |
```

Críticos → fix inline (commit no Phase 13) OU phase decimal `13.1` se for grande. Não-críticos → entry final no `v1.1-REQUIREMENTS.md` deferred section.

### D-06: Outcome tracking (Plan 13-02)

Ao arquivar v1.1, registrar pra cada requirement:
- **DELIVERED:** entregue conforme especificado
- **DELIVERED with deviation:** entregue com decisão consciente diferente (ex: aniversário usa multi-admin via has_role em vez de hardcode David Grabarz)
- **DEFERRED:** não entregue, motivo + para qual milestone

Modelo de referência: `.planning/milestones/v1.0-REQUIREMENTS.md`.

### D-07: Smoke setup data

Não criar contas Smoke A/B novas — Phase 9 já validou RLS bilateral. Para integration smoke, usar:
- Conta admin (Lenny ou Lucas) pra montar fluxos
- Se precisar testar isolamento colab, criar 1 colab teste single-use e deletar no fim (não 2 como em Phase 9)

Cliente teste de smoke da Phase 13 será deletado ao fim (idem cleanup pattern Phase 12).

## Canonical refs

- `.planning/ROADMAP.md` — Phase 13 entry (linhas 125-134) + success criteria
- `.planning/REQUIREMENTS.md` — para identificar todos os REQ-IDs do marco v1.1
- `.planning/milestones/v1.0-ROADMAP.md` — padrão de archive pra replicar
- `.planning/milestones/v1.0-REQUIREMENTS.md` — padrão de outcome tracking
- `.planning/phases/08-cadastros-opcionalizar-imagens/*-SUMMARY.md` e similares — features já entregues a integrar no smoke

## Scope guardrail

**Não fazer nesta phase:**
- Refatoração de cálculos (próximo milestone, conforme PROJECT.md Next Milestone Goals)
- Testes automatizados Vitest/Playwright permanentes (marco de qualidade próprio)
- Fix dos follow-ups documentados das phases anteriores (WR-02 cron alerts, SPF/DKIM) — esses vão pra backlog v1.2+

## Deferred (já documentado pra v1.2+)

- WR-02 (Phase 12 review): pg_net 4xx/5xx monitoring
- SPF/DKIM/DMARC do domínio orcamentosaura.com.br (email caindo em Junk)
- IMP-02 (Phase 3 v1.0): preço por CSV
- Refatoração fórmulas (fita/driver/perfil/agrupamento)
- Margem no pedido (depende tabela de preços/custos)
- Documentação + testes das fórmulas

## Success criteria (do ROADMAP, mapeado pra plans)

| # | Critério | Plan |
|---|----------|------|
| 1 | Smoke prod executado cobrindo cadastro, RLS, wizard, PDF, dashboard, automação | 13-01 |
| 2 | Bugs registrados, priorizados, corrigidos OU deferidos com justificativa | 13-01 (BUGS.md) |
| 3 | ROADMAP/REQUIREMENTS/STATE atualizados com outcome | 13-02 |
| 4 | Marco arquivado em `.planning/milestones/v1.1-*.md` + MILESTONES.md index | 13-02 |

## Next step

`/gsd-plan-phase 13` — gerar 13-01-PLAN.md (smoke + bugs) e 13-02-PLAN.md (archive).
