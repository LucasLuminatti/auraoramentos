---
phase: 10-wizard-edi-o-status-descri-o-rica
plan: "04"
subsystem: pedidos-status-reabrir-rascunho
tags: [wiz-03, wiz-04, status-dropdown, reabrir-rascunho, alert-dialog, rls]
dependency_graph:
  requires: [10-01, 10-02, 10-03]
  provides: [dropdown-status-pedidos, reabrir-rascunho-wizard, initial-orcamento-id]
  affects: [Admin.tsx, Index.tsx, Step3Revisao.tsx]
tech_stack:
  added: []
  patterns:
    - shadcn Select com disabled-when-aprovado (invariante one-way visual)
    - AlertDialog de confirmacao irreversivel (aprovado)
    - otimistic state update sem refetch completo
    - location.state (useLocation) para comunicacao Admin→Index sem query param
    - useEffect de mount para inicializar state interno com prop externa
key_files:
  created: []
  modified:
    - src/pages/Admin.tsx
    - src/pages/Index.tsx
    - src/components/Step3Revisao.tsx
decisions:
  - "D-07: entry point unico no card de Pedidos para reabrir rascunho"
  - "D-08: sempre reabre no Step 1 com prefill completo"
  - "D-09: navigate('/', { state: { orcamentoId } }) sem rota nova"
  - "D-10: cliente orfao → toast.error + redirect, sem abrir wizard"
  - "D-11: save do rascunho editado faz UPDATE no mesmo id (nao duplicata)"
  - "D-13: dropdown shadcn Select no card de Pedidos"
  - "D-14: sempre disponivel (nao exige PDF gerado)"
  - "D-15: colab dono + admin podem mudar (RLS ja filtra server-side)"
  - "D-16: so aprovado e one-way — AlertDialog antes de confirmar"
  - "D-17: badge colorido por status (muted/yellow/emerald/red)"
  - "D-18: status change dispara toast.success"
metrics:
  duration: "~25min"
  completed: "2026-05-14"
  tasks_completed: 4
  files_modified: 3
---

# Phase 10 Plan 04: Reabrir Rascunho + Status Dropdown — Summary

**One-liner:** Dropdown shadcn de status com AlertDialog one-way para aprovado + reabrir rascunho via location.state com prefill completo no wizard.

## O que foi entregue

### Task 1: Componente StatusBadgeSelect + handleStatusChange (Admin.tsx)

Adicionado sub-componente local `StatusBadgeSelect` (linhas ~71–130 de Admin.tsx):

- `Select` shadcn com 4 opções (rascunho, pendente, aprovado, perdido)
- `disabled={isAprovado}` — invariante one-way visual; combinado com RLS server-side (Plan 10-01) faz defesa em camadas
- Seleção de `aprovado` abre `AlertDialog` "Marcar como aprovado é irreversível" — só após confirmar dispara UPDATE
- `onClick={(e) => e.stopPropagation()}` em SelectTrigger, SelectContent, AlertDialogContent e no div wrapper da TableCell — impede que clique no dropdown dispare o navigate da TableRow

`handleStatusChange` no componente Admin:
- UPDATE via `supabase.from('orcamentos').update({ status: novo }).eq('id', id)`
- Erro com mensagem de RLS exibe toast amigável ("Você não tem permissão...")
- Otimistic update: `setOrcamentos(prev => prev.map(...))` sem refetch completo
- `toast.success('Status atualizado para ${novo}')` em sucesso

### Task 2: TableRow clicável + StatusBadgeSelect plugado + coluna Ações removida (Admin.tsx)

- TableRow rascunho: `navigate('/', { state: { orcamentoId: o.id } })` — abre wizard no Index
- TableRow outros status: mantém `navigate('/admin/orcamento/${o.id}')` (página de detalhe)
- `title={o.status === 'rascunho' ? 'Continuar este rascunho' : undefined}` — tooltip nativo
- Coluna "Status" agora renderiza badge visual + `<StatusBadgeSelect>` lado a lado
- Coluna "Ações" removida do `<TableHead>` e do body; `colSpan` do empty state ajustado de 7 para 6

### Task 3: Index.tsx detecta location.state.orcamentoId e popula wizard (Index.tsx)

Novos imports: `useLocation`, `useEffect`, `supabase`, `toast`.

Novos hooks e state:
- `location = useLocation()`
- `orcamentoParaReabrir` — lê `location.state?.orcamentoId` de forma segura
- `reopenedOrcamentoId` — armazena o id para passar ao Step3

`useEffect` de reabertura:
- Fetch `orcamentos` com JOIN `clientes:cliente_id(id, nome)` + `projetos:projeto_id(id, nome)`
- Trata 3 caminhos de erro: (1) Supabase retorna erro → toast + redirect; (2) `!data` → toast + redirect; (3) `!data.clientes` (cliente órfão) → toast específico + redirect
- Sucesso: popula `dados`, `ambientes`, `currentClienteId/Nome`, `currentProjetoId/Nome`, `reopenedOrcamentoId`, `setStep(1)`, `setMode('create')`
- `navigate('/', { replace: true, state: null })` — limpa state para evitar re-fetch em refresh

`handleNovoOrcamento` e `handleConfirmarVoltar`: ambos chamam `setReopenedOrcamentoId(null)` para garantir que novo orçamento não herde id do rascunho anterior.

`Step3Revisao` recebe `initialOrcamentoId={reopenedOrcamentoId ?? undefined}`.

### Task 4: Step3Revisao aceita initialOrcamentoId (Step3Revisao.tsx)

- `Step3Props` ganhou prop opcional `initialOrcamentoId?: string` com JSDoc explicando o propósito
- Assinatura da função atualizada para desestruturar a nova prop
- `useEffect(() => { if (initialOrcamentoId) setOrcamentoId(initialOrcamentoId); }, [])` — roda apenas no mount; inicializa o state `orcamentoId` com o id existente
- `persistirOrcamento` permanece intacto: o branch `if (orcamentoId)` já fazia UPDATE — agora funciona corretamente para rascunhos reabertos (evita duplicate INSERT)

## Verificação

- [x] StatusBadgeSelect renderiza badge + Select disabled quando aprovado
- [x] AlertDialog para aprovado aparece; só após confirmar dispara UPDATE
- [x] handleStatusChange faz UPDATE + toast + state local sem refetch
- [x] TableRow rascunho navega para "/" com state.orcamentoId
- [x] TableRow outros status mantém /admin/orcamento/:id
- [x] Index.tsx fetcha orçamento + JOIN clientes; trata cliente órfão
- [x] Index.tsx popula wizard no Step 1 com prefill completo
- [x] Step3Revisao aceita initialOrcamentoId + useEffect inicializa o state
- [x] Coluna "Ações" removida; colSpan empty state = 6
- [x] `npm run build` exit 0
- [x] `npm run test -- --run` 47/47 testes passando

## Commits

- `c9bbce8` — feat(10-04): StatusBadgeSelect + handleStatusChange + rascunho navigate + coluna Acoes removida
- `b5a0981` — feat(10-04): reabrir rascunho via location.state + initialOrcamentoId em Step3

## Deviações do plano

Nenhuma — plano executado exatamente como escrito.

## Known Stubs

Nenhum — todos os dados são lidos de Supabase em runtime.

## Threat Flags

Nenhum — nenhuma nova surface de segurança além das descritas no `<threat_model>` do plano.

## Self-Check: PASSED

- `src/pages/Admin.tsx` — presente e com StatusBadgeSelect, handleStatusChange, navigate rascunho
- `src/pages/Index.tsx` — presente com useLocation, orcamentoParaReabrir, useEffect de reabertura
- `src/components/Step3Revisao.tsx` — presente com initialOrcamentoId prop + useEffect de mount
- Commits `c9bbce8` e `b5a0981` verificados via git log
- Build verde (✓ built in 10.90s)
- 47 testes passando
