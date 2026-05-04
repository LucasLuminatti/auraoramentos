---
phase: 04-drive-rls-reorganiza-o-admin
plan: 05
subsystem: ui
tags: [admin, orcamento-detalhe, read-only, pdf-reemissao, route, row-clickable]

requires:
  - phase: 04-drive-rls-reorganiza-o-admin / Plan 03
    provides: Aba Pedidos em Admin.tsx (TabsContent value="pedidos") com tabela de orçamentos
  - phase: 04-drive-rls-reorganiza-o-admin / Plan 04
    provides: Tela ADM-02 estável (não bloqueia, mas mantém Plans 04-01..04 commitados antes)
provides:
  - Página /admin/orcamento/:id read-only (ADM-01)
  - Botão Re-emitir PDF chamando gerarOrcamentoHtml + html2pdf
  - Linha de Pedidos clicável com navegação para a nova rota
  - Fechamento do todo 2026-04-27-admin-orcamentos-row-nao-clicavel
affects:
  - src/pages/Admin.tsx (TableRow agora com onClick)

tech-stack:
  added: []
  patterns:
    - "Página dedicada read-only com fetch via supabase.from().select() com joins (clientes(arquitetos), colaboradores, projetos)"
    - "Snapshot orcamento.ambientes (Json) tratado defensivamente com Array.isArray + optional chaining (?.) + ?? [] em todos os arrays — Pitfall 8"
    - "Re-emitir PDF reusa exatamente o pipeline do Step3Revisao: gerarOrcamentoHtml → container off-screen → html2pdf().save()"
    - "TableRow + onClick (linha clicável) com botão interno usando e.stopPropagation() para não disparar navegação ao clicar no Flag"

key-files:
  created:
    - src/pages/OrcamentoDetalhe.tsx
  modified:
    - src/App.tsx
    - src/pages/Admin.tsx
  closed-todos:
    - .planning/todos/done/2026-04-27-admin-orcamentos-row-nao-clicavel.md (movido pending → done)

key-decisions:
  - "Re-emitir PDF via html2pdf().save() (download direto), mesmo padrão do Step3Revisao — não window.open com Ctrl+P"
  - "logoBase64 carregado via fetch + FileReader em useEffect próprio (separado do fetch de dados) para não bloquear render se falhar"
  - "Total geral exibido = calcularTotalGeral(ambientes) recalculado do snapshot, mostrado lado a lado com o valor armazenado em orcamentos.valor (campo Valor) — útil para auditar discrepâncias sem alterar nada"
  - "Cards na ordem Resumo / Cliente e Arquiteto / Projeto e Colaborador / Ambientes / Histórico de Exceções (renderizado só com exceptions.length > 0)"
  - "Field component local (label + value) reusado nos cards de Cliente/Arquiteto/Projeto/Colaborador para reduzir markup repetitivo"
  - "Status de exceção ganha cor própria via exceptionStatusClass (aprovado=verde, rejeitado=vermelho, pendente=amarelo) — separado do statusClass de orçamento"
  - "Voltar usa navigate('/admin?tab=pedidos') sem -1 do history — preserva semântica do D-21 mesmo se usuário entrou direto via URL"

patterns-established:
  - "Pattern: leitura de snapshot Json com Array.isArray + cast tipado + optional chaining em todos os campos — pode ser reusado em qualquer tela que ler orcamentos.ambientes histórico"
  - "Pattern: linha de tabela clicável + botão de ação interno com stopPropagation — reutilizável em qualquer tabela que tenha drill-down + ações inline"

requirements-completed: [ADM-01]

duration: ~25min
completed: 2026-05-04
---

# Phase 04 / Plan 05: OrcamentoDetalhe (ADM-01) Summary

**Página `/admin/orcamento/:id` read-only com fetch completo (cliente + arquiteto + colaborador + projeto + snapshot ambientes + histórico de exceções) + Re-emitir PDF + linha de Pedidos clicável.** Fecha o todo `2026-04-27-admin-orcamentos-row-nao-clicavel.md` aberto desde 2026-04-27.

## Performance

- **Duration:** ~25 min (3 tasks auto + checkpoint para orchestrator)
- **Completed:** 2026-05-04
- **Tasks:** 3/3 implementadas (Task 4 = checkpoint Playwright/code-review pelo orchestrator)
- **Files created:** 1 (OrcamentoDetalhe.tsx)
- **Files modified:** 2 (App.tsx, Admin.tsx)
- **Todos closed:** 1 (movido pending → done)

## Accomplishments

### Task 1 — OrcamentoDetalhe.tsx (página completa)

**Arquivo:** `src/pages/OrcamentoDetalhe.tsx` (515 linhas).

**Estado:**
- `orc: OrcamentoFull | null` — orçamento + relações.
- `exceptions: ExceptionRow[]` — histórico de exceções daquele orçamento.
- `loading: boolean` — guarda render durante fetch.
- `logoBase64: string` — logo encoded para o PDF.
- `gerando: boolean` — disable do botão durante render do PDF.

**Effects:**
1. **Mount + id changes:** Busca orcamento via `supabase.from("orcamentos").select(...)` com joins de `clientes(arquitetos)`, `colaboradores`, `projetos`. Em paralelo (sequencial após o single) busca `price_exceptions` ordered by `created_at`.
2. **Mount only:** Carrega `logo.png` via fetch + FileReader em base64 para uso no PDF.

**Funções:**
- `statusLabel` / `statusClass` — copiados de Admin.tsx (Rascunho/Enviado/Aprovado/Fechado/Perdido).
- `exceptionStatusClass` — novo, mapeia aprovado/rejeitado/pendente.
- `sanitizarNomeArquivo` — mesmo da Step3Revisao para o filename do PDF.
- `handleReemitirPdf` — pipeline idêntico ao Step3:
  1. Monta `PdfParams` do snapshot (clienteNome via `orc.clientes?.nome`, etc.).
  2. `gerarOrcamentoHtml(params)` → string HTML.
  3. Container off-screen (`position: fixed; left: -10000px`) com innerHTML.
  4. Dynamic import de `html2pdf.js` → `.from(.page).set({...}).save()`.
  5. `try/finally` garante remover o container do DOM mesmo em erro.

**JSX:** Header sticky com logo + botões (Voltar + Re-emitir PDF). Body com 4-5 cards:
1. **Resumo** — Status (Badge), Tipo, Data, Valor, Fechado em (se houver), Motivo de perda (se houver), Total geral recalculado.
2. **Cliente e Arquiteto** — 2 colunas: cliente (nome/contato/email/telefone/CPF-CNPJ) + arquiteto (nome/contato) ou "Sem arquiteto vinculado".
3. **Projeto e Colaborador** — 2 colunas com Field local.
4. **Ambientes** — `(orc.ambientes ?? []).map(...)`. Cada ambiente em `border rounded-lg p-3` com:
   - Tabela de luminárias (Código mono + Descrição + Qtd + Preço un + Subtotal via `calcularSubtotalLuminaria`).
   - Lista de sistemas (Sistema N: Fita + Driver + Perfil opcional, com códigos + descrições do snapshot).
   - "Nenhum item neste ambiente" se ambos vazios.
5. **Histórico de Exceções** — só renderiza se `exceptions.length > 0`. Tabela com Data + Produto (código mono + descrição) + Solicitado + Mínimo + Status (Badge colorido).

**Estados de erro/empty:**
- Loading: spinner + "Carregando..."
- Não encontrado: Card "Orçamento não encontrado" com mensagem amigável.

**Pitfall 8 mitigado:** todos os acessos a `orc.ambientes`, `amb.luminarias`, `amb.sistemas`, `s.fita`, `s.driver`, `s.perfil`, `l.codigo`, etc. usam optional chaining + defaults (`?? []`, `?? "—"`, `Number(...) || 0`). Snapshots antigos sem campos novos não crasham.

### Task 2 — Rota /admin/orcamento/:id em App.tsx

- Import `OrcamentoDetalhe from "./pages/OrcamentoDetalhe"` adicionado entre `AdminUploadImagens` e `Drive`.
- `<Route path="/admin/orcamento/:id" element={<AdminRoute><OrcamentoDetalhe /></AdminRoute>} />` adicionado logo após `/admin/upload-imagens`, mantendo grupo das rotas admin.
- Sem mais nenhuma mudança em App.tsx.

### Task 3 — Linha de Pedidos clicável + Flag stopPropagation + todo movido

**Admin.tsx:**
- `<TableRow key={o.id}>` agora tem `role="button"`, `className="cursor-pointer hover:bg-muted/50"`, `onClick={() => navigate(\`/admin/orcamento/\${o.id}\`)}`.
- `<button>` do Flag (Encerrar negociação) ganhou `e.stopPropagation()` na primeira linha do `onClick` — impede navegação ao clicar no botão de encerrar.

**Todo movido:**
- `.planning/todos/pending/2026-04-27-admin-orcamentos-row-nao-clicavel.md` → `.planning/todos/done/2026-04-27-admin-orcamentos-row-nao-clicavel.md` no MESMO commit (atomicidade explícita no plan).

## Task Commits

1. **Task 1 — OrcamentoDetalhe page** — `f129b69` (feat, --no-verify)
2. **Task 2 — Route registration** — `2b48854` (feat, --no-verify)
3. **Task 3 — Row clickable + stopPropagation + close todo** — `acf2e99` (feat, --no-verify)

## Files Created/Modified

- `src/pages/OrcamentoDetalhe.tsx` (created, 515 linhas)
- `src/App.tsx` (modified — +import +1 route)
- `src/pages/Admin.tsx` (modified — TableRow onClick + Flag stopPropagation)
- `.planning/todos/done/2026-04-27-admin-orcamentos-row-nao-clicavel.md` (moved from pending/)

## Cobertura D-XX

| Decisão | Coberto por |
|---------|-------------|
| **D-18** Página dedicada `/admin/orcamento/:id` (não modal), URL própria → permite compartilhar link | Nova rota em App.tsx; AdminRoute protege; URL com `:id` é shareable |
| **D-19** Read-only no v1; única ação = Re-emitir PDF | Sem nenhum campo editável; `handleReemitirPdf` é o único side effect; sem botões de salvar/atualizar/cancelar |
| **D-20** Conteúdo: cliente + arquiteto + colaborador + status + ambientes + totais + histórico de exceções | 4 cards fixos + 5º card condicional (exceções), todos com os campos especificados |
| **D-21** Botão Voltar leva para aba Pedidos com URL state preservado | `navigate("/admin?tab=pedidos")` — Admin.tsx já lê `?tab=` via useSearchParams (ver Plan 04-03) |

## Cobertura must_haves do plano

| Truth | Resultado |
|-------|-----------|
| Rota /admin/orcamento/:id existe protegida por AdminRoute | ✓ |
| Página mostra cliente, arquiteto (via clientes.arquitetos), colaborador, projeto, status, totais e snapshot ambientes (D-20) | ✓ |
| Página mostra histórico de exceções quando houver | ✓ (Card só renderiza se `exceptions.length > 0`) |
| Botão Re-emitir PDF chama gerarPdfHtml com PdfParams montado a partir do snapshot e baixa o PDF (D-19) | ✓ (via gerarOrcamentoHtml + html2pdf — função real exportada pelo lib) |
| Botão Voltar para lista navega para /admin?tab=pedidos (D-21) | ✓ |
| Linha da tabela de Pedidos no Admin é clicável e leva para /admin/orcamento/:id | ✓ |
| Snapshot antigo (sem campos novos) renderiza sem crash via optional chaining | ✓ (Pitfall 8 — `?.` + `?? []` em todos os acessos) |

## Decisions Made

- **Re-emitir PDF via html2pdf().save()** — mesmo pipeline do Step3Revisao para consistência de output. Plan mencionava `gerarPdfHtml(...).then(...)` mas a função real exportada é `gerarOrcamentoHtml(params): string`. Corrigido durante implementação para usar o pipeline correto que já está em produção.
- **logoBase64 em useEffect separado** — o fetch do logo é independente do fetch dos dados; falha do logo não deve impedir render dos campos.
- **Field component local em vez de Card.Field global** — escopo restrito; sem necessidade de export.
- **exceptionStatusClass separado de statusClass** — domínios diferentes (orçamento vs exceção), mantém legibilidade.
- **Total geral mostrado recalculado do snapshot** (calcularTotalGeral) — útil para auditar discrepâncias com o `orcamentos.valor` armazenado, sem permitir edição.

## Threat Coverage

| Threat ID | Mitigação aplicada |
|-----------|--------------------|
| **T-04-19** Não-admin acessa /admin/orcamento/:id | `<AdminRoute>` em App.tsx; AdminRoute redireciona não-admin para `/` (ASVS V4.1) |
| **T-04-20** URL ID inválido (UUID malformed) | `.single()` retorna `{error}`; toast.error + Card "Orçamento não encontrado" |
| **T-04-21** Snapshot adulterado em DB tem campos faltando e crasha render | Optional chaining + `?? []` + `?? "—"` + `Number(...) || 0` em todos os acessos (Pitfall 8) |
| **T-04-22** console.log de orcamento completo expõe dados de cliente | Não há `console.log(orc)` ou `console.log(data)` — apenas `console.error("Erro ao gerar PDF:", err)` que loga o erro, não os dados |

Sem threat flags novos. Nenhum stub introduzido.

## Verification Results

| Verificação | Resultado |
| --- | --- |
| `test -f src/pages/OrcamentoDetalhe.tsx` | ✓ |
| `grep -c "gerarOrcamentoHtml" src/pages/OrcamentoDetalhe.tsx` | 2 ✓ |
| `grep -c "/admin?tab=pedidos" src/pages/OrcamentoDetalhe.tsx` | 1 ✓ |
| `grep -c "/admin/orcamento/:id" src/App.tsx` | 1 ✓ |
| `grep -c "OrcamentoDetalhe" src/App.tsx` | 2 ✓ |
| `grep -c 'navigate(\`/admin/orcamento/' src/pages/Admin.tsx` | 1 ✓ |
| `grep -c "stopPropagation" src/pages/Admin.tsx` | 1 ✓ |
| `npm run build` | ✓ verde (3 builds, 20-39s cada) |
| Todo movido para `.planning/todos/done/` | ✓ |

## Smoke Check Pendente (Task 4 — checkpoint orchestrator)

Pipeline automático per CLAUDE.md global:
1. **Code review** sobre o diff (OrcamentoDetalhe.tsx + App.tsx + Admin.tsx).
2. **Playwright MCP** em `/admin?tab=pedidos`:
   - Hover linha → cursor:pointer + bg muted/50.
   - Clicar linha → navegar para `/admin/orcamento/{id}`.
   - Cards renderizam: Resumo, Cliente e Arquiteto, Projeto e Colaborador, Ambientes (com luminárias e sistemas do snapshot), Histórico de Exceções (se houver).
   - Botão "Re-emitir PDF" → PDF baixa.
   - Botão "Voltar para lista" → URL volta para `/admin?tab=pedidos`.
   - Pedido com `status=enviado/aprovado` → clicar Flag → modal Encerrar abre **sem navegar** (stopPropagation).
   - Snapshot antigo (luminarias/sistemas vazios ou ausentes) → não crasha.
3. Console JS: 0 erros vermelhos.

## Deviations from Plan

**Mínima — nome da função PDF.**

Plan referenciou `gerarPdfHtml(params): Promise<void>` (que baixa o PDF), mas a função real exportada por `src/lib/gerarPdfHtml.ts` é `gerarOrcamentoHtml(params): string` (que retorna o HTML). O download via html2pdf é responsabilidade do caller (como Step3Revisao já faz).

Implementação correta = mesmo pipeline do Step3Revisao:
- `gerarOrcamentoHtml(params)` → HTML string.
- Container off-screen com innerHTML.
- Dynamic import html2pdf → `.from(.page).set({...}).save()`.
- `try/finally` para garantir cleanup do container.

Categoria: Rule 1 (correção de erro de assumption do plan, comportamento idêntico ao desejado).

## Issues Encountered

- **PreToolUse READ-BEFORE-EDIT reminders** entre Edits — não bloquearam as edições (todas foram aplicadas no Edit prévio + reportadas como sucesso); apenas verboso. Mesmo behavior reportado no Plan 04-04.
- **Build warning** "logo.png static + dynamic import" — pré-existente, não relacionado ao Plan 04-05 (mesmo aviso desde Plan 04-04 e antes).

## Notes para Plan 04-06 (Docs / Closure)

- Todo `2026-04-27-admin-orcamentos-row-nao-clicavel.md` JÁ FOI movido para `done/` no commit `acf2e99` (Task 3). Plan 06 não precisa fechar — só registrar no SUMMARY/closure que foi resolvido aqui.
- ADM-01 está completo. Plan 06 deve focar em ADM-03 (documentação in-app de exceções) + ADM-05 (dashboard simplificado) + closure docs.

## Next Phase Readiness

- **Plan 04-06 (ADM-03 + ADM-05 + closure):** próximo. ADM-01 / ADM-02 / ADM-04 / Drive RLS já cobertos.
- **Phase 5+:** edição inline de pedido em ADM-01 fica deferida (D-19 explicitamente read-only no v1; reabrir via wizard é tarefa de phase futura).

## Self-Check

- [x] Files modified existem:
  - `src/pages/OrcamentoDetalhe.tsx` ✓ (f129b69)
  - `src/App.tsx` ✓ (2b48854)
  - `src/pages/Admin.tsx` ✓ (acf2e99)
  - `.planning/todos/done/2026-04-27-admin-orcamentos-row-nao-clicavel.md` ✓ (acf2e99 — rename)
- [x] Commits no git log:
  - f129b69 ✓ (Task 1)
  - 2b48854 ✓ (Task 2)
  - acf2e99 ✓ (Task 3 + todo)
- [x] Build verde (`npm run build`) — 3 builds passaram
- [x] Todo `2026-04-27-admin-orcamentos-row-nao-clicavel.md` movido para `done/`
- [x] AdminRoute protege a nova rota
- [x] Snapshot antigo não crasha (optional chaining + defaults em todos os acessos)

## Self-Check: PASSED

---
*Phase: 04-drive-rls-reorganiza-o-admin*
*Completed: 2026-05-04*
