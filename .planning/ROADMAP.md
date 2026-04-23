# Roadmap: AURA — Marco 1 (Validacao)

**Created:** 2026-04-23
**Milestone:** Marco 1 — Validacao (UAT ate zero bug)
**Deadline:** 2026-04-30
**Granularity:** coarse
**Core Value:** Um colaborador consegue montar um orcamento real, do zero ao PDF entregue, sem bug e sem precisar de suporte.

## Phases

- [ ] **Phase 1: Preparacao do UAT** — Checklist escrito, contas de teste prontas, git limpo, template de bug versionado
- [ ] **Phase 2: UAT Core — Colaborador (Auth + Wizard)** — Caminho critico do colaborador: do cadastro ao PDF gerado, sem bug
- [ ] **Phase 3: UAT Admin + Infra (Admin + Drive + Edge)** — Dashboard admin, file explorer e edge functions validados, sem bug
- [ ] **Phase 4: Varredura Transversal e Fechamento** — Consoles limpos, zero cosmetico, relatorio final de UAT entregue

## Phase Details

### Phase 1: Preparacao do UAT
**Goal**: Tudo o que precisa estar pronto antes da primeira tela ser testada esta pronto — sem improvisar quando a execucao comecar.
**Depends on**: Nothing (first phase)
**Requirements**: PREP-01, PREP-02, PREP-03, PREP-04
**Success Criteria** (what must be TRUE):
  1. `.planning/uat/CHECKLIST.md` existe, cobre 100% das Validated do PROJECT.md, organizado por fluxo (auth, wizard, admin, drive, edge, transversal)
  2. Template de relatorio de bug existe (campos: esperado, ocorrido, passos, severidade, status, commit de fix)
  3. Git status limpo: mudancas pendentes em `request-access`, `review-access`, `config.toml` e `linked-project.json` foram commitadas ou revertidas com decisao documentada
  4. Conta admin de teste e conta colaborador de teste autenticam em prod (vercel kappa) e tem dados minimos para rodar todos os fluxos
**Plans**: TBD

### Phase 2: UAT Core — Colaborador (Auth + Wizard)
**Goal**: O caminho critico do colaborador — cadastrar, logar, montar orcamento, gerar PDF — executa fim a fim em prod sem bug, com correcoes on-the-fly aplicadas.
**Depends on**: Phase 1
**Requirements**: AUTH-UAT-01, AUTH-UAT-02, AUTH-UAT-03, AUTH-UAT-04, AUTH-UAT-05, AUTH-UAT-06, ORC-UAT-01, ORC-UAT-02, ORC-UAT-03, ORC-UAT-04, ORC-UAT-05, ORC-UAT-06, ORC-UAT-07, ORC-UAT-08, ORC-UAT-09, ORC-UAT-10, ORC-UAT-11, ORC-UAT-12, FIX-01
**Success Criteria** (what must be TRUE):
  1. Todos os 6 itens AUTH-UAT marcados como passed no CHECKLIST (cadastro, login, reset, logout, role gate, auto-create colaborador)
  2. Todos os 12 itens ORC-UAT marcados como passed — wizard completo (lista de clientes, Step 1, Step 2 CRUD ambientes/luminarias/sistemas, Step 3 calculos/violacao/excecao/PDF/snapshot)
  3. PDF real gerado e baixado em prod com layout correto (cabecalho, ambientes, itens, totais, precos) e registro correspondente em `orcamentos` no Supabase
  4. Todo bug encontrado foi corrigido via commit+push, retestado no mesmo fluxo, e registrado no template de bug (FIX-01)
  5. Zero bugs abertos em AUTH-UAT ou ORC-UAT ao final da fase
**Plans**: TBD
**UI hint**: yes

### Phase 3: UAT Admin + Infra (Admin + Drive + Edge)
**Goal**: O lado admin (dashboard completo), o Drive e as edge functions executam sem bug em prod, com correcoes on-the-fly aplicadas.
**Depends on**: Phase 2
**Requirements**: ADM-UAT-01, ADM-UAT-02, ADM-UAT-03, ADM-UAT-04, ADM-UAT-05, ADM-UAT-06, ADM-UAT-07, ADM-UAT-08, DRV-UAT-01, DRV-UAT-02, DRV-UAT-03, DRV-UAT-04, EDGE-UAT-01, EDGE-UAT-02, EDGE-UAT-03, EDGE-UAT-04
**Success Criteria** (what must be TRUE):
  1. Todos os 8 itens ADM-UAT marcados como passed — 5 abas (Produtos, Colaboradores, Orcamentos, Clientes, Excecoes), upload de imagens, CSV de produtos/precos, aprovacao de excecao com reflexo real-time no Step 3
  2. Todos os 4 itens DRV-UAT marcados como passed — listagem, upload (drag-drop e botao), navegacao com breadcrumb, download e exclusao
  3. Todas as 4 edge functions (`request-access`, `review-access`, `create-colaborador`, `validar-sistema-orcamento`) executam sem erro quando acionadas pelos fluxos correspondentes — verificavel em logs do Supabase
  4. Todo bug encontrado foi corrigido via commit+push, retestado no mesmo fluxo, e registrado no template de bug (FIX-01 aplicado tambem nesta fase)
  5. Zero bugs abertos em ADM-UAT, DRV-UAT ou EDGE-UAT ao final da fase
**Plans**: TBD
**UI hint**: yes

### Phase 4: Varredura Transversal e Fechamento
**Goal**: Tudo que atravessa a aplicacao (toasts, guards de rota, 404, responsividade, console limpo) passa a varredura final; zero cosmetico remanescente; relatorio final entregue.
**Depends on**: Phase 3
**Requirements**: CROSS-UAT-01, CROSS-UAT-02, CROSS-UAT-03, CROSS-UAT-04, CROSS-UAT-05, FIX-02, REP-01
**Success Criteria** (what must be TRUE):
  1. Todos os 5 itens CROSS-UAT marcados como passed — toasts em toda operacao Supabase, redirect para `/auth` quando nao autenticado, `/NotFound` renderiza, layout utilizavel em 1366x768 e 1920x1080, console do browser sem warnings/errors nos fluxos principais
  2. Zero bugs cosmeticos remanescentes (texto incorreto, layout quebrado, cor fora do padrao) — varredura visual completa nos 3 fluxos criticos (colaborador, admin, drive) (FIX-02)
  3. `.planning/uat/RELATORIO.md` publicado: lista o que foi testado, bugs encontrados, commits de correcao referenciados por hash, estado final (REP-01)
  4. Nenhum item das 46 requirements v1 permanece aberto — CHECKLIST inteiro com status "passed" ou "passed-after-fix"
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Preparacao do UAT | 0/0 | Not started | - |
| 2. UAT Core — Colaborador (Auth + Wizard) | 0/0 | Not started | - |
| 3. UAT Admin + Infra (Admin + Drive + Edge) | 0/0 | Not started | - |
| 4. Varredura Transversal e Fechamento | 0/0 | Not started | - |

## Coverage Summary

- **v1 requirements:** 46
- **Mapped:** 46/46 (100%)
- **Orphaned:** 0
- **Duplicated:** 0

**Distribution:**
- Phase 1: 4 requirements (PREP-01 a PREP-04)
- Phase 2: 19 requirements (6 AUTH-UAT + 12 ORC-UAT + FIX-01)
- Phase 3: 16 requirements (8 ADM-UAT + 4 DRV-UAT + 4 EDGE-UAT). FIX-01 reaparece como criterio observavel tambem nesta fase, mas o requirement formal esta contabilizado uma unica vez em Phase 2 para evitar duplicacao na traceability.
- Phase 4: 7 requirements (5 CROSS-UAT + FIX-02 + REP-01)

**Note on FIX-01:** FIX-01 esta oficialmente mapeado a Phase 2 (onde e aplicado pela primeira vez). Seu comportamento (corrigir on-the-fly) e um criterio de sucesso tambem em Phase 3 — o requirement nao se repete na traceability, mas a pratica continua ate o fim do UAT.

---
*Roadmap created: 2026-04-23*
