# AURA

## What This Is

Sistema web de criação de orçamentos de iluminação da Luminatti, em produção (https://orcamentosaura.com.br + Vercel kappa). Colaboradores montam orçamentos em wizard de 3 passos (cliente/projeto → ambientes com sistemas de LED → revisão e PDF), e admins gerenciam produtos, preços, clientes, exceções e documentos. Backend em Supabase (auth, Postgres, edge functions, storage); frontend em React 18 + Vite + TypeScript + shadcn-ui.

## Core Value

Um colaborador consegue montar um orçamento real, do zero ao PDF entregue, com dados organizados por arquiteto e filtráveis — e o admin consegue controlar preços, pedidos e margens sem planilha paralela.

## Current Milestone: v1.3 — Sistemas Compostos (MAGNETO / TINY / MODULAR)

**Goal:** O colaborador monta sistemas compostos direto no wizard — trilho magnético 48V (MAGNETO 22), trilho 24V (TINY MAG) e perfil modular (SYSTEM MOLD) — com módulos, driver dimensionado automaticamente (assistido, mas auditável) e componentes obrigatórios checados, em vez de adicioná-los como luminária avulsa. Resolve os comentários UAT 8, 9, 11 e parte do 10, movidos da v1.2 por serem evolução estrutural.

**Target features (do MVP da pesquisa 2026-06-10, P1→P3):**
- Seletor de tipo de sistema (Fita Padrão / Modular / Magnético 48V / Magnético 24V) — branch point; default "Fita Padrão" preserva o fluxo atual intocado
- Fluxo Magnético 48V — trilho + módulos + conector obrigatório LM2338 + driver auto-dimensionado (LM2343 100W / LM2344 200W), promovendo `analisarMagneto48V` de aviso → ação
- Fluxo Magnético 24V (TINY MAG) — trilho + módulos + conector LM3168/LM3169 + driver 24V dimensionado
- Fluxo Modular SYSTEM MOLD — perfil modular + módulos difusos + fita auto-derivada + driver 24V
- Voltage lock 48V + checklist de componentes obrigatórios + atalho "adicionar componente faltante"
- Aviso (não-bloqueante) no Step 2→3 se sistema composto incompleto + fix de filtro de catálogo (conector/kit_fixacao)
- Painel de recomendação de driver com "aplicar" + duplicar sistema composto entre ambientes
- PDF v3 — seção "Sistemas Compostos" (camada nova, não substitui PDF v2)

**Diretrizes de implementação (aprovadas por Lenny):**
- Fita Padrão deve continuar funcionando exatamente como hoje
- Arquitetura aditiva — não quebrar projetos existentes, snapshots ou PDFs já gerados
- Decisão de modelagem prioriza a opção **mais conservadora e compatível** com a estrutura atual (`luminarias[].composicao?` vs `sistemas[].tipo` discriminator — resolver na 1ª fase)
- Dimensionamento de driver é assistido pelo sistema mas **sempre auditável** pelo usuário (nunca silencioso/irreversível)
- Checklists/validações previnem erro sem tornar o fluxo excessivamente bloqueante
- PDF v3 é camada nova para compostos — não arrisca a estabilidade do PDF v2
- **Sem ampliar escopo:** nada de BOM genérico, auto-split de circuitos 48V, dimming/CCT por módulo, módulos de terceiros, multi-voltagem no mesmo trilho
- Tech debt entra só se tocar diretamente o fluxo de compostos (o fix de filtro de catálogo já faz parte; WR-01 passadas fica fora)

**Pesquisa:** reusada integralmente de `.planning/research/` (STACK/FEATURES/ARCHITECTURE/PITFALLS, 2026-06-10, HIGH confidence) — sem reabrir fase de pesquisa.

## Current State

**Latest milestone shipped:** v1.2 — Correções UAT + UX do Wizard de Sistemas de Iluminação (2026-06-10 → 2026-06-12, 3 dias)

Novo em prod com v1.2 (subsistema fita/perfil/driver/magneto do wizard):
- **Catálogo corrigido** — 401 perfis + 18 fitas que sumiam dos seletores por `tipo_produto` null/errado ganharam o valor correto em PROD (migration aditiva); dica MAGNETO 48V validada (já estava correta no dado)
- **Validação de tensão** — voltagem do driver inferida da fita, pré-filtro do seletor + aviso de divergência não-bloqueante (toast + badge), grouping global por (código+voltagem), advisory TINY 24V, driver compatível sugerido como default ao escolher a fita
- **Cálculo/metragem** — gate impede fita sem perfil avançar com 0m silencioso (R$0), metragem do perfil refletida automaticamente na descrição, passadas editáveis por família + migration de sync `passadas_padrao`
- **Resumo coerente** — chips de LOCAL por fita ("Ambiente — Local · Xm") na tela e no PDF v2 (com foto da fita), fita sem duplicação confusa ("incluída no Resumo de Fitas"), drivers por ambiente (bloco global rebaixado a Collapsible interno), advisory ao avançar sem lâmpada esperada
- **UX transversal** — redirect ao buscar código de categoria errada em Luminárias, microcopy inline nas abas, Duplicar sistema + Duplicar ambiente (novos UUIDs), checklist "Verificação pré-PDF" no Step 3 com gate no botão Gerar PDF

Em prod de v1.0 + v1.1:
- **Wizard 3 passos editável** (Step1 dados → Step2 ambientes → Step3 revisão com edição preço/qtd + status pós-PDF → PDF v2)
- **Admin reorganizado** em 5 sub-tabs: Início (dashboard com card único Orçamentos em Aberto) / Cadastros (Produtos/Arquitetos/Clientes/Colaboradores) / Pedidos / Preços / Exceções
- **Arquiteto como entidade** com FK em clientes/produtos + CRUD admin (expandido com nascimento/endereço/banco) + filtros em 3 listas
- **Signup expandido** (CPF validado + telefone BR + setor enum) com gate em `allowed_users`
- **Cadastros opcionalizados** — cliente sem Contato/CPF/Arquiteto + arquiteto expandido + AU001..16 editáveis + ImageIcon inline em qualquer SKU
- **Importação CSV** de produtos com preview + ImportMaster XLSX one-shot (2.088 variants oficiais) + ImportImagens
- **Multi-tenancy RLS** em `arquitetos` + `clientes` (Phase 9) — colab vê só `user_id = auth.uid()`, admin vê tudo via `has_role`, smoke bilateral E2E PASS 5/5
- **Drive RLS por user_id** (Phase 4 D-02 errata) — colaborador isolado, admin vê tudo, signed URLs
- **PDF v2** (Playfair Display + Inter, header limpo, total com barra dourada, prose final formatada) **sem bloco "Sistemas" vazio** + prazo "20 dias úteis" + descrição rica (temp/pot/IRC/nicho da ImportMaster) com **roteador v1/v2** retro-compatível
- **Dashboard métrica única** — card "Orçamentos em Aberto" substitui 6 cards de métrica
- **Filtros combinados em Pedidos** (arquiteto + cliente + período + status)
- **Automação Aniversário D-5** (Phase 12) — cron diário `0 9 * * *` UTC chama edge fn `aniversario-clientes` (Deno + Resend) → email pra colab dono + admins via `has_role(admin)` dinâmico. Log auditável em `aniversario_envios` (RLS admin-only, UNIQUE idempotência). Vault `service_role_key` autentica cron via runtime subquery.

Schema:
- 22 migrations aditivas aplicadas (zero destrutivas; v1.0 = 9 + v1.1 = 11 + v1.2 = 2: `tipo_produto_correcao_catalogos`, `sync_passadas_padrao`)
- 5 edge functions deployed: `create-colaborador`, `import-produtos`, `request-access`, `review-access`, `aniversario-clientes`
- Extensions: pg_cron 1.6.4 + pg_net 0.20.0 (habilitadas em Phase 12)

Validação prod:
- v1.0 smoke 8/8 itens passed (2026-05-07, Playwright + 2 contas reais)
- v1.1 smoke 4/4 cenários integration PASS (2026-05-15, Phase 13) + 1 bug crítico BUG-13-01 fixed inline
- v1.2: e2e/catalogo.spec.ts 3/3 contra PROD + Playwright E2E Phase 18 (0 erros console) + 128 unit tests verdes + build verde

## Validated Requirements (v1.0)

Migradas pra `.planning/milestones/v1.0-REQUIREMENTS.md`. Resumo: 40 entregues + 1 obsoleto (PROD-02 — DB já tinha 0 produtos sem desc/preço; substituído por SKUs coringa AU001..AU016) + 1 deferido (IMP-02 — preço por CSV; vai pra phase de preços em v1.1+).

## Validated Requirements (v1.1)

Migradas pra `.planning/milestones/v1.1-REQUIREMENTS.md`. Resumo: 17 entregues + 1 com deviation (AUTO-02 — multi-admin via `has_role(admin)` em vez de hardcode "David Grabarz") + 0 deferidos = 18/18 covered (100%).

**Categorias entregues:** FORM-01..04 (cadastros opcionalizados/expandidos), RLS-01..03 (multi-tenancy em arquitetos/clientes), WIZ-01..05 (wizard editável + descrição rica), PDF-01..02 (PDF v2 lapidado), DASH-01 (card único Orçamentos em Aberto), AUTO-01..03 (automação aniversário D-5).

**Bug crítico capturado e resolvido inline:** BUG-13-01 (ClienteDialog faltava campo `data_nascimento` apesar do schema existir desde Phase 7; commit `b3ae4db`).

**Follow-ups deferidos pra v1.2+:** WR-02 pg_net monitoring, SPF/DKIM domínio (email Junk Outlook), dedup `toList` aniversário, IMP-02 preço CSV (carryover v1.0), refatoração fórmulas, margem, docs+testes, bucket `produto-imagens` singular cleanup.

## Validated Requirements (v1.2)

Migradas pra `.planning/milestones/v1.2-REQUIREMENTS.md`. Resumo: **18/18 entregues (100%)** em 6 categorias — CAT-01/02 (catálogo), TENS-01/02 + SIST-04 + UX-02 (tensão/advisory), CALC-01/02/03 (cálculo/metragem), RES-01..05 (resumo), UX-01/03/04/05 (UX de raiz). Origem: UAT dos funcionários (19 comentários com prints, 2026-06-10); 16 corrigidos na v1.2, 3 de montagem de sistemas compostos (MAGNETO/TINY/MODULAR) movidos para **v1.3**.

**Auditoria de fechamento:** `tech_debt` (sem blockers; 18/18 satisfeitos, build verde, 128 testes verdes, integração cross-phase limpa). Débito aceito e rastreado: **WR-01** (passadas travadas em [1] para 160 produtos de famílias sem regra — `light_30/light_12/light_15`; fix de 1 linha `produto.passadas ?? 3`), advisory TINY 24V fora do checklist pré-PDF (LOW), tag `<\strong>` cosmética em Step3Revisao, 3 warnings de code review na Phase 18, e 11 itens de UAT visual pendentes de confirmação manual em prod (Marco 1). Detalhe em `.planning/milestones/v1.2-MILESTONE-AUDIT.md`.

## Out of Scope (perpetual)

| Feature | Reason |
|---------|--------|
| Margem no pedido | Marco 2 — depende de tabela de preços/custos que Lenny ainda vai receber |
| Refatoração de cálculos | Marco 3 — fórmulas só mexidas depois de documentadas e revisadas |
| Módulo de comissões | Marco 4 — feature nova complexa |
| Role nova "representante" | Representante = colaborador; não inflacionar roles |
| Validação de CPF/CNPJ no cliente (form) | Campos opcionais; validação só no signup |
| Integração com ERP | Sem necessidade imediata; CSV manual resolve |
| Redesign geral de UI | Ajustes pontuais sim (PDF, admin), redesign não |
| Testes automatizados (Vitest/Playwright) | Marco de qualidade próprio |

## Next Milestone Goals (post-v1.2)

**v1.3 — Sistemas Compostos (MAGNETO / TINY / MODULAR)** é o candidato principal (já registrado no backlog/roadmap):
- **SIST-01/02/03** — montagem de sistema MAGNETO 48V, TINY MAGNETO 24V e SYSTEM MOLD (módulos + driver dimensionado + componentes obrigatórios) em vez de luminária avulsa
- **Decisão de arquitetura pendente:** compostos em `sistemas[]` (discriminated union) vs `luminarias[].composicao?` (pesquisa recomenda o 2º, mais conservador) — resolver no início da v1.3
- **PDF v3** com seção rica de compostos

Outros candidatos na fila (carryover):
- **PDF vetorial** (Backlog 999.1, prioridade alta) — substituir rasterização html2canvas
- **Preços via CSV** (IMP-02 deferido) + tabela de custos pra desbloquear margem
- **Margem no pedido** + **documentação/testes das fórmulas de cálculo** (Marco 3)

## Constraints (perpetual)

- **Tech stack:** React 18 + Vite + TypeScript + Supabase + shadcn-ui — sem trocar stack
- **Schema:** Mudanças aditivas (novas colunas nullable, novas tabelas) — **não quebrar** queries existentes
- **Compatibilidade:** Snapshots/orçamentos antigos continuam renderizando (PDF v1/v2 router cobre isso)
- **Fluxo atual:** Wizard 3 passos não pode quebrar
- **Segurança:** RLS do Drive validada com 2 contas reais (v1.0 smoke #7); admin vê tudo, colab só o próprio
- **Campos opcionais vs obrigatórios:** cliente (contato/CPF/arquiteto) opcionais; signup (CPF/telefone/setor) obrigatórios

## Key Decisions (carryover de v1.0 + v1.1)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Arquiteto = entidade própria com FK | Filtros confiáveis, evita divergência textual | ✓ Validated v1.0 |
| Representante = colaborador existente | Setor resolve; não inflacionar roles | ✓ Validated v1.0 |
| Margem adiada para marco 2 | Depende de tabela de custos | — Pending |
| CPF validado no signup | Dado vira base de comissões; entrar sujo cria passivo | ✓ Validated v1.0 |
| Importação via CSV manual | Fluxo realista; integração ERP fica pra marco futuro | ✓ Validated v1.0 |
| Reescrever PDF do zero | Redesign + remover caixas não se resolve com patch | ✓ Validated v1.0 |
| Schema aditivo, nunca destrutivo | Dados de produção existem | ✓ Validated v1.0 (9 migrations) + v1.1 (11 migrations) — zero regressão |
| Drive RLS via user_id (não colaborador_id) | Direto com auth.uid(); evita confusão (Phase 4 D-02 errata) | ✓ Validated v1.0 + replicado em arquitetos/clientes Phase 9 |
| Storage policy via tabela cliente_arquivos | Não migrar paths legados (Phase 4 D-09 errata) | ✓ Validated v1.0 |
| Dashboard como sub-tab Início (não rota) | Consistência com tab strip (Phase 4 D-26 errata) | ✓ Validated v1.0 |
| PDF v1/v2 roteador via `pdf_template_version` | Backwards-compat sem dual-render | ✓ Validated v1.0 + estendido v1.1 (PDF-01/02 e WIZ-05 sem quebrar snapshots) |
| Filtros via URL search params (não global) | Compartilhável + bookmark + sobrevive refresh | ✓ Validated v1.0 |
| Multi-tenancy zero-code-change no client (RLS + DEFAULT auth.uid()) | Replica padrão Drive D-02; preflight 11 callsites = 0 Risk | ✓ Validated v1.1 (Phase 9) |
| Multi-admin dinâmico via `has_role(admin)` (D-22) | Hardcode "David Grabarz" não escala; RPC `buscar_admins_emails()` suporta N admins sem redeploy | ✓ Validated v1.1 (Phase 12, AUTO-02 deviation) |
| Stored fns SECURITY DEFINER vs JOIN inline | Evita N+1, desacopla schema da edge fn, contorna restrição `auth.users` | ✓ Validated v1.1 (Phase 12) |
| UNIQUE(cliente_id, ano_referencia) = idempotência atomic | Edge fn trata PG 23505 como "já enviado"; row única por (cliente, ano) preserva auditoria | ✓ Validated v1.1 (Phase 12) |
| Vault subquery em RUNTIME pro cron | Cron lê `decrypted_secret` a cada disparo; rotação propaga sem redeploy | ✓ Validated v1.1 (Phase 12) |
| Builder `construirDescricaoRica` com fallback ao snapshot puro | ImportMaster é fonte da verdade; snapshots antigos sem campos rich continuam renderizando | ✓ Validated v1.1 (Phase 10 WIZ-05) |
| Recategorizar `tipo_produto` via migration aditiva (não tocar snapshots) | Snapshot jsonb é autocontido; recategorização só afeta novas buscas, não orçamentos salvos | ✓ Validated v1.2 (Phase 14, CAT-01) |
| Divergência de voltagem é advisory, nunca bloqueio | Bloqueio entre ambientes era o bug (UAT#6); validação só por-sistema (fita vs driver do mesmo sistema) + toast | ✓ Validated v1.2 (Phase 15, TENS-01/02) |
| Advisory composto puro na v1.2; montagem → v1.3 | TINY/MAGNETO montagem é evolução estrutural (~40% esforço/todo risco); v1.2 só avisa, não monta (D-06) | ✓ Validated v1.2 (Phase 15, SIST-04) |
| Gate de metragem no avanço Step 2→3 (não default em addSistema) | Guard no advancement é a fix correta para CALC-01; não fabricar dado silencioso | ✓ Validated v1.2 (Phase 16, CALC-01) |
| RES-01 display-only (chips de LOCAL, sem tocar cálculo) | Decisão travada do Lenny: anotação visual, não accounting por LOCAL; preserva `calcularRolosPorGrupo` e layout | ✓ Validated v1.2 (Phase 17) |
| Clones com `crypto.randomUUID()` em toda a árvore | Duplicar sistema/ambiente sem colisão de key; cálculo agrupa por código (não id), clones somam corretamente | ✓ Validated v1.2 (Phase 18, RES-04/UX-04) |
| Checklist pré-PDF como painel inline no Step 3 (não modal/reestruturação) | Decisão travada do Lenny: dentro do fluxo atual; gate `temErroBloqueante` aditivo preserva `hasUnresolved` | ✓ Validated v1.2 (Phase 18, UX-05) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Current State + Validated Requirements + Key Decisions

---
*Last updated: 2026-06-12 — milestone v1.3 iniciado (Sistemas Compostos MAGNETO/TINY/MODULAR). v1.2 shipped e arquivado em `.planning/milestones/v1.2-*.md`. Pesquisa reusada de `.planning/research/`. Próximo: definir requirements + roadmap (fases continuam a partir da 19).*
