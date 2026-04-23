# Requirements: AURA — Marco 1 (Validação)

**Defined:** 2026-04-23
**Core Value:** Um colaborador consegue montar um orçamento real, do zero ao PDF entregue, sem bug e sem precisar de suporte.

> **Contexto do marco:** AURA já está em produção. Este marco é *validação* do estado atual — UAT manual executado em prod (vercel kappa), corrigindo bugs on-the-fly, até zero bug remanescente. **Não** é redesign, refatoração, ou novas features. Cálculos, apesar de cobertos pelo UAT (comportamento visível), não são refatorados aqui — isso é marco 2.

## v1 Requirements

### Preparação

- [ ] **PREP-01**: Checklist de UAT escrito e versionado em `.planning/uat/CHECKLIST.md`, cobrindo 100% das Validated do PROJECT.md
- [ ] **PREP-02**: Template de relatório de bug criado (o que esperava, o que aconteceu, passos, severidade, status)
- [ ] **PREP-03**: Mudanças pendentes no git status (edge functions `request-access`/`review-access`, `config.toml`) revisadas e decididas: commitar ou reverter antes do UAT começar
- [ ] **PREP-04**: Conta de teste (admin) e conta de teste (colaborador) prontas em prod, com dados mínimos pra rodar todos os fluxos

### UAT — Autenticação e Acesso

- [ ] **AUTH-UAT-01**: Cadastro via `/request-access` → aprovação no admin → signup completa funciona ponta a ponta
- [ ] **AUTH-UAT-02**: Login com email/senha persiste sessão após refresh e redireciona corretamente
- [ ] **AUTH-UAT-03**: Fluxo `/forgot-password` → email recebido → `/reset-password` → nova senha funcional
- [ ] **AUTH-UAT-04**: Logout limpa sessão e bloqueia rotas protegidas
- [ ] **AUTH-UAT-05**: Role admin acessa `/admin`; colaborador é bloqueado por `AdminRoute`
- [ ] **AUTH-UAT-06**: Colaborador recém-criado tem registro auto-gerado na tabela `colaboradores` no primeiro login

### UAT — Wizard de Orçamento

- [ ] **ORC-UAT-01**: ClienteList (mode=list) exibe clientes/projetos/orçamentos sem erro e operações (criar/editar/duplicar/excluir) funcionam
- [ ] **ORC-UAT-02**: Step 1 — seleção de cliente/projeto e tipo de revisão valida e persiste
- [ ] **ORC-UAT-03**: Step 2 — CRUD de ambientes funciona (adicionar, editar nome, excluir, reordenar se houver)
- [ ] **ORC-UAT-04**: Step 2 — adicionar `ItemLuminaria` standalone com busca de produto e preço
- [ ] **ORC-UAT-05**: Step 2 — adicionar `SistemaIluminacao` (fita + driver + perfil opcional) com combinações válidas
- [ ] **ORC-UAT-06**: Step 3 — cálculos de metragem, drivers, agrupamento de rolos e totais exibem resultado consistente com dados inseridos (*valida comportamento visível; não refatorar fórmulas*)
- [ ] **ORC-UAT-07**: Step 3 — detecção de violação de preço dispara alerta quando preço < mínimo
- [ ] **ORC-UAT-08**: Step 3 — ajustar preço para o mínimo resolve a violação
- [ ] **ORC-UAT-09**: Step 3 — solicitar exceção via ExceptionChat cria registro e notifica admin em tempo real
- [ ] **ORC-UAT-10**: Step 3 — geração de PDF baixa arquivo válido com layout correto (cabeçalho, ambientes, itens, totais, preços)
- [ ] **ORC-UAT-11**: Step 3 — snapshot do orçamento persistido em `orcamentos` ao gerar PDF (verificar no banco)
- [ ] **ORC-UAT-12**: Clicar no logo durante wizard avisa sobre dados não salvos antes de voltar

### UAT — Admin e Exceções

- [ ] **ADM-UAT-01**: Aba Produtos — busca por nome, listagem, edição de preços funcional
- [ ] **ADM-UAT-02**: Aba Colaboradores — listagem e edição (incluindo mudanças de role) funcional
- [ ] **ADM-UAT-03**: Aba Orçamentos — listagem, abrir snapshot, exportar funcional
- [ ] **ADM-UAT-04**: Aba Clientes — CRUD de clientes e projetos funcional
- [ ] **ADM-UAT-05**: Aba Exceções — admin vê solicitações pendentes e aprova/rejeita
- [ ] **ADM-UAT-06**: Aprovação de exceção reflete em tempo real no Step 3 do colaborador que solicitou
- [ ] **ADM-UAT-07**: `/admin/upload-imagens` — upload de imagens de produtos funcional
- [ ] **ADM-UAT-08**: Importações CSV (produtos, preços) — importa sem erro e dados aparecem corretamente

### UAT — Drive e Edge Functions

- [ ] **DRV-UAT-01**: `/drive` carrega estrutura de pastas sem erro
- [ ] **DRV-UAT-02**: Upload de arquivo funcional (drag-drop e botão)
- [ ] **DRV-UAT-03**: Navegação por pastas (entrar, voltar, breadcrumb) funcional
- [ ] **DRV-UAT-04**: Download e exclusão de arquivo funcional
- [ ] **EDGE-UAT-01**: Edge function `request-access` — submissão do formulário público cria registro pendente
- [ ] **EDGE-UAT-02**: Edge function `review-access` — admin aprova/rejeita e status reflete corretamente
- [ ] **EDGE-UAT-03**: Edge function `create-colaborador` — executa no primeiro login do usuário sem erro
- [ ] **EDGE-UAT-04**: Edge function `validar-sistema-orcamento` — retorna validação correta quando chamada pelo Step 3

### UAT — Transversal

- [ ] **CROSS-UAT-01**: Toasts de erro/sucesso aparecem em todas as operações que usam Supabase (sem operação silenciosa)
- [ ] **CROSS-UAT-02**: Rotas protegidas redirecionam para `/auth` quando não autenticado
- [ ] **CROSS-UAT-03**: Páginas inexistentes renderizam `/NotFound` sem quebrar
- [ ] **CROSS-UAT-04**: Responsividade básica — layout utilizável em laptop (1366×768) e desktop (1920×1080)
- [ ] **CROSS-UAT-05**: Nenhum warning/error no console do browser durante fluxos principais

### Correção e Fechamento

- [ ] **FIX-01**: Todo bug encontrado durante UAT é corrigido via commit+push, retestado, e marcado como resolvido
- [ ] **FIX-02**: Nenhum bug cosmético (texto incorreto, layout quebrado, cor fora do padrão) remanescente
- [ ] **REP-01**: Relatório final de UAT em `.planning/uat/RELATORIO.md` — lista o que foi testado, bugs encontrados, commits de correção, e estado final

## v2 Requirements

Marcos/ciclos futuros. Não entram neste marco.

### Cálculos (Marco 2 — próximo)

- **CALC-01**: Refatoração e documentação da lógica de cálculos (fita, driver, perfil, agrupamento de rolos)
- **CALC-02**: Testes unitários cobrindo todas as fórmulas de `src/types/orcamento.ts`
- **CALC-03**: Revisão de regras de negócio com a Luminatti (confirmar fórmulas contra planilha atual)

### Features Futuras

- **FEAT-01**: Módulo de comissões
- **FEAT-02**: Integração com ERP da Luminatti
- **FEAT-03**: Mobile-first redesign

### Qualidade

- **QA-01**: Suite de testes automatizados (Vitest + Playwright)
- **QA-02**: CI/CD com checks obrigatórios antes de deploy
- **QA-03**: Error tracking em produção (Sentry ou similar)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Refatoração de cálculos | Marco 2 — não mexer em fórmulas antes de garantir estabilidade do entorno |
| Testes automatizados | Manual UAT é suficiente aqui; automação é marco de qualidade próprio |
| Redesign / mudança de UX | Não é retrabalho visual — é validação de estabilidade |
| Reescrita de edge functions | Só corrigir se UAT pegar bug; não reescrever "porque podia melhorar" |
| Novas features (comissões, ERP, etc.) | Depois de cálculos estabilizados |
| Migração de schema do banco | Só se UAT exigir |
| Setup de domínio próprio de email (Resend) | Infra separada; afeta deliverability mas não é bloqueador do UAT |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PREP-01 | Phase 1 | Pending |
| PREP-02 | Phase 1 | Pending |
| PREP-03 | Phase 1 | Pending |
| PREP-04 | Phase 1 | Pending |
| AUTH-UAT-01 | Phase 2 | Pending |
| AUTH-UAT-02 | Phase 2 | Pending |
| AUTH-UAT-03 | Phase 2 | Pending |
| AUTH-UAT-04 | Phase 2 | Pending |
| AUTH-UAT-05 | Phase 2 | Pending |
| AUTH-UAT-06 | Phase 2 | Pending |
| ORC-UAT-01 | Phase 2 | Pending |
| ORC-UAT-02 | Phase 2 | Pending |
| ORC-UAT-03 | Phase 2 | Pending |
| ORC-UAT-04 | Phase 2 | Pending |
| ORC-UAT-05 | Phase 2 | Pending |
| ORC-UAT-06 | Phase 2 | Pending |
| ORC-UAT-07 | Phase 2 | Pending |
| ORC-UAT-08 | Phase 2 | Pending |
| ORC-UAT-09 | Phase 2 | Pending |
| ORC-UAT-10 | Phase 2 | Pending |
| ORC-UAT-11 | Phase 2 | Pending |
| ORC-UAT-12 | Phase 2 | Pending |
| ADM-UAT-01 | Phase 3 | Pending |
| ADM-UAT-02 | Phase 3 | Pending |
| ADM-UAT-03 | Phase 3 | Pending |
| ADM-UAT-04 | Phase 3 | Pending |
| ADM-UAT-05 | Phase 3 | Pending |
| ADM-UAT-06 | Phase 3 | Pending |
| ADM-UAT-07 | Phase 3 | Pending |
| ADM-UAT-08 | Phase 3 | Pending |
| DRV-UAT-01 | Phase 3 | Pending |
| DRV-UAT-02 | Phase 3 | Pending |
| DRV-UAT-03 | Phase 3 | Pending |
| DRV-UAT-04 | Phase 3 | Pending |
| EDGE-UAT-01 | Phase 3 | Pending |
| EDGE-UAT-02 | Phase 3 | Pending |
| EDGE-UAT-03 | Phase 3 | Pending |
| EDGE-UAT-04 | Phase 3 | Pending |
| CROSS-UAT-01 | Phase 4 | Pending |
| CROSS-UAT-02 | Phase 4 | Pending |
| CROSS-UAT-03 | Phase 4 | Pending |
| CROSS-UAT-04 | Phase 4 | Pending |
| CROSS-UAT-05 | Phase 4 | Pending |
| FIX-01 | Phase 2 | Pending |
| FIX-02 | Phase 4 | Pending |
| REP-01 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 46 total
- Mapped to phases: 46 (100%)
- Unmapped: 0 ✓

**Note on FIX-01:** mapeado formalmente a Phase 2 (primeira fase em que UAT é executado e bugs podem aparecer). A prática de fix-on-the-fly continua como critério de sucesso em Phase 3 — sem duplicar o requirement na traceability.

---
*Requirements defined: 2026-04-23*
*Last updated: 2026-04-23 after roadmap creation (traceability populated)*
