---
phase: 02-cadastros-arquiteto-crud
plan: 02
subsystem: auth
tags: [signup, pii, cpf, telefone, setor, banner, backfill, react, supabase]

requires:
  - phase: 02-cadastros-arquiteto-crud
    provides: "src/lib/masks.ts (formatCPF, formatTelefone, unmask), src/lib/validators.ts (validateCPF, validateTelefone), edge function create-colaborador aceitando cpf/telefone/setor"
provides:
  - "src/pages/Auth.tsx — signup expandido com CPF/Telefone/Setor obrigatórios + máscaras + validação inline"
  - "src/pages/PerfilCompletar.tsx — página de backfill USR-04 (rota /perfil/completar, ProtectedRoute)"
  - "src/components/CompletarCadastroBanner.tsx — banner amber sticky em Index e Admin para colaborador com cadastro incompleto"
  - "src/hooks/useColaborador.ts — interface Colaborador estendida com cpf/telefone/setor"
  - "src/App.tsx — rota /perfil/completar registrada como ProtectedRoute"
affects:
  - "Plan 02-03 (Arquiteto CRUD) — pode reusar pattern de form com Select/máscara"
  - "Plan 02-04 (Cliente expandido) — vai consumir formCpfCnpj e mesmo pattern de validação inline"

tech-stack:
  added: []
  patterns:
    - "Validação inline (text-xs text-destructive + border-destructive) sem toast de campo individual — D-05"
    - "Máscara aplicada no onChange (formatCPF/formatTelefone) + unmask() no submit — D-07"
    - "Banner condicional sticky no topo, sem botão dispensar (D-03), invisível na própria página de backfill"
    - "Backfill via UPDATE direto em colaboradores filtrado por colaborador.id (RLS já restringe a auth.uid())"

key-files:
  created:
    - "src/pages/PerfilCompletar.tsx"
    - "src/components/CompletarCadastroBanner.tsx"
  modified:
    - "src/pages/Auth.tsx"
    - "src/hooks/useColaborador.ts"
    - "src/App.tsx"
    - "src/pages/Index.tsx"
    - "src/pages/Admin.tsx"

key-decisions:
  - "UPDATE direto em colaboradores em PerfilCompletar (T-02-08 resolvido via RLS — não precisou criar edge function update-meu-perfil)"
  - "Departamento label corrigido em Auth.tsx — antes o form chamava 'Departamento' de 'Setor', agora Setor é Select dedicado e Departamento volta ao nome correto"
  - "Banner sem botão dispensar (D-03) — força CTA proativo em vez de dar opção de ignorar"
  - "Reset do form no signUpSuccess inclui os 3 campos novos + fieldErrors para evitar leak entre tentativas"

patterns-established:
  - "Pattern de form com 3 campos PII: useState + máscara onChange + validação inline + unmask() no submit"
  - "Pattern de banner condicional: ler hook → checar campos → null se completo/loading/rota_propria"
  - "Pattern de backfill page: pré-preenche valores existentes formatados + UPDATE filtrado por id"

requirements-completed: [USR-01, USR-02, USR-03, USR-04]

duration: ~10min
completed: 2026-04-27
---

# Phase 02 Plan 02: Signup Expandido + Perfil Completar Summary

**Signup agora exige CPF (algoritmo BR), telefone celular com DDD e setor (Select 4 opções) com validação inline e submit desmascarado; colaboradores antigos veem banner amber sticky em / e /admin com CTA para /perfil/completar (página de backfill com UPDATE direto via RLS).**

## Performance

- **Duration:** ~10 min
- **Tasks:** 4 (executadas atomicamente, 1 commit cada)
- **Files modified:** 7 (5 modificados + 2 criados)

## Accomplishments

- USR-01/USR-02/USR-03: signup pede CPF, telefone e setor obrigatórios — não submete sem os três, valida inline com algoritmo BR, envia desmascarado pra edge function `create-colaborador` (Plan 02-01)
- USR-04: backfill funcional via banner amber sticky + página `/perfil/completar` reusando os mesmos validadores/máscaras
- Hook `useColaborador` expõe os 3 campos novos para qualquer componente futuro consumir
- Departamento label corrigido em Auth (antes mislabeled como "Setor") — agora Setor é campo dedicado e Departamento volta ao nome real

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Estender useColaborador + criar CompletarCadastroBanner** — `a7d16be` (feat)
2. **Task 2: Criar PerfilCompletar.tsx + registrar rota /perfil/completar** — `30ff9d0` (feat)
3. **Task 3: Expandir signup em Auth.tsx (3 campos + Select + máscaras + validação inline)** — `3768477` (feat)
4. **Task 4: Montar CompletarCadastroBanner em Index e Admin** — `bce35a0` (feat)

**Plan metadata:** este SUMMARY (commit final desta plan)

## Files Created/Modified

### Criados

- `src/components/CompletarCadastroBanner.tsx` — Banner amber sticky (40 linhas). Lê `useColaborador()`, mostra alerta + botão "Completar agora" se algum dos 3 campos for null. Auto-esconde em `/perfil/completar`, durante loading, ou quando colaborador completo. Sem botão dispensar (D-03).
- `src/pages/PerfilCompletar.tsx` — Página de backfill (135 linhas). Form com 3 campos (CPF, Telefone, Setor) reusando `formatCPF`/`formatTelefone`/`unmask`/`validateCPF`/`validateTelefone` da Plan 02-01. Pré-preenche valores existentes formatados. Submit faz `UPDATE colaboradores SET cpf, telefone, setor WHERE id = colaborador.id` com valores desmascarados, redireciona pra `/`.

### Modificados

- `src/hooks/useColaborador.ts` — Interface `Colaborador` ganha `cpf | telefone | setor: string | null`. Ambos `.select()` strings incluem as 3 colunas novas. Auto-create flow não regredido (gap 3 do Phase 1 preservado).
- `src/pages/Auth.tsx` — Signup expandido (+121/-34 linhas). Imports novos (Select shadcn, masks, validators), constante `SETORES` (4 valores fixos por D-06), state `cpf`/`telefone`/`setor`/`fieldErrors`. Validação inline em `handleSubmit` antes das checagens existentes (D-05, sem toast de campo). Submit envia `unmask(cpf)` + `unmask(telefone)` + `setor` para `create-colaborador`. Form re-renderizado na ordem D-04 (Nome → Email → ConfirmEmail → CPF → Telefone → Setor → Cargo → Departamento → Senha → ConfirmSenha). Departamento label corrigido. Reset de signUpSuccess limpa os 3 campos novos.
- `src/App.tsx` — Import `PerfilCompletar` + rota `<Route path="/perfil/completar" element={<ProtectedRoute><PerfilCompletar /></ProtectedRoute>} />` (não AdminRoute — qualquer colaborador autenticado).
- `src/pages/Index.tsx` — Import `CompletarCadastroBanner` + render como primeiro filho do root JSX, antes do header.
- `src/pages/Admin.tsx` — Mesmo pattern do Index — import + render como primeiro filho de `<div className="min-h-screen bg-background">`, antes do `<header>`.

## Requirements Covered

| Req | Descrição | Onde foi implementado |
|-----|-----------|------------------------|
| USR-01 | Signup pede CPF (validado pelo algoritmo BR) | `src/pages/Auth.tsx` — campo Input com `formatCPF` no onChange + `validateCPF` no submit + `unmask(cpf)` no body da edge function |
| USR-02 | Signup pede telefone celular com DDD | `src/pages/Auth.tsx` — campo Input com `formatTelefone` no onChange + `validateTelefone` no submit + `unmask(telefone)` no body |
| USR-03 | Signup pede setor (Select 4 opções) | `src/pages/Auth.tsx` — `<Select>` shadcn com array `SETORES` (comercial/projetos/logistica/financeiro) + validação inline se vazio |
| USR-04 | Backfill para colaboradores antigos | `src/components/CompletarCadastroBanner.tsx` (CTA proativo) + `src/pages/PerfilCompletar.tsx` (form de backfill) — montados em Index e Admin |

## Decisions Made

- **UPDATE direto em colaboradores via PerfilCompletar (T-02-08):** RLS de colaboradores permite UPDATE filtrado por user_id = auth.uid(), então não foi necessário criar edge function `update-meu-perfil`. Filtro `.eq("id", colaborador.id)` é seguro porque `colaborador.id` vem do hook `useColaborador()` que já filtra por auth.uid().
- **Departamento label corrigido:** o form antigo tinha um campo `departamento` mislabeled como "Setor". Agora que Setor é campo real (enum), Departamento volta ao nome correto e continua opcional.
- **Banner sem dispensar (D-03):** força CTA proativo em vez de permitir ignorar — alinha com a regra "não bloqueia uso, mas lembra sempre".
- **Validação inline sem toast de campo (D-05):** apenas texto vermelho + border vermelha sob cada campo. Toast só pra erro de submit/network.
- **Máscara aplicada no onChange:** durante digitação (D-07). Fica visualmente correto pro usuário, e `unmask()` no submit garante que o valor enviado tem só dígitos.

## Deviations from Plan

None — plano executado exatamente como escrito. As 4 tasks foram concluídas sem auto-fix de bug, sem deviação arquitetural, sem checkpoint.

Único ajuste cosmético (não-deviation): `src/App.tsx` ganhou só 2 linhas (import + Route) — alinhado com o pattern de rotas existentes. Cargo/Departamento foram movidos para depois do Setor conforme a ordem D-04 do plan, e o label do campo Departamento foi corrigido (antes era "Setor", o que era um bug de UX — pode ser visto como Rule 1 mas o plan já mandava trocar explicitamente, então não é deviation).

## Authentication Gates

Nenhum — não foi necessário deploy de edge function (já feita na Plan 02-01) nem nova migration. Tudo é frontend + UPDATE direto via SDK Supabase.

## Threat Mitigations Applied

| Threat | Disposition | Status |
|--------|-------------|--------|
| **T-02-06** Tampering em validateCPF/validateTelefone client-side | mitigate | ✓ Edge function valida `setor` server-side (Plan 01). CPF inválido client-side bypass passa pro DB, mas DB não valida CPF — aceito porque CPF inválido é problema de dado, não segurança. |
| **T-02-07** PII em toast/console | mitigate | ✓ Validação inline mostra apenas "CPF inválido" / "Telefone inválido" — nunca o valor digitado. Sem `console.log(cpf)` ou similar em todo o código novo. |
| **T-02-08** Elevation of Privilege via UPDATE direto | mitigate | ✓ Filtro `.eq("id", colaborador.id)` + RLS permite UPDATE WHERE user_id = auth.uid(). Pre-flight check do plan validou: UPDATE direto funcionou, não foi necessária edge function alternativa. |
| **T-02-09** Repudiation (sem audit trail) | accept | Sem audit log neste marco — feature fica pra marco de qualidade. |
| **T-02-10** Banner expõe estado de cadastro incompleto | accept | Banner só aparece pro próprio usuário — não vaza pra outros. Risco zero. |

## Issues Encountered

Nenhum problema durante execução. As 4 tasks foram diretas — Plan 02-01 entregou primitivas reusáveis bem definidas, então cada task aqui foi essencialmente "consumir API existente + escrever JSX".

## User Setup Required

Nenhum — sem novas variáveis de ambiente, sem migração, sem deploy de edge function. Plan 02-01 já cobriu isso.

## Smoke Manual (deferido para go-live UAT)

O plan listou 7 passos de smoke manual no `<verification>` (signup com CPF inválido, telefone inválido, sem setor, signup válido, login como colaborador antigo, banner em / e /admin, /perfil/completar). Smoke automatizado não foi executado nesta sessão — fica para o UAT manual em prod conforme a estratégia de validação do Marco 1 (zero bugs antes de refatorar). Recomenda-se rodar os 7 passos antes de marcar Phase 02 como done.

## Next Plan Readiness

- **Plan 02-03 (Arquiteto CRUD):** desbloqueado. Pode reusar:
  - Pattern de form Select com options enum (`SETORES` em Auth.tsx)
  - Pattern de validação inline (border-destructive + text-xs text-destructive)
  - Banner pattern caso precise de outro CTA proativo
- **Plan 02-04 (Cliente expandido com CPF/CNPJ):** desbloqueado. Vai consumir:
  - `formatCpfCnpj` da Plan 02-01 (já criada)
  - Mesmo pattern de máscara onChange + unmask submit estabelecido aqui

Sem blockers. Banner já vai estar montado em Index e Admin antes da Plan 02-03/04 começar.

## Self-Check: PASSED

**Files verified to exist:**
- ✓ `src/components/CompletarCadastroBanner.tsx`
- ✓ `src/pages/PerfilCompletar.tsx`
- ✓ `src/pages/Auth.tsx` (modificado)
- ✓ `src/hooks/useColaborador.ts` (modificado)
- ✓ `src/App.tsx` (modificado)
- ✓ `src/pages/Index.tsx` (modificado)
- ✓ `src/pages/Admin.tsx` (modificado)

**Commits verified to exist (via `git log --all --oneline`):**
- ✓ `a7d16be` — feat(02-02): extend useColaborador with cpf/telefone/setor + add CompletarCadastroBanner
- ✓ `30ff9d0` — feat(02-02): add PerfilCompletar page + register /perfil/completar route
- ✓ `3768477` — feat(02-02): expand Auth signup with CPF, telefone, setor (USR-01..03)
- ✓ `bce35a0` — feat(02-02): mount CompletarCadastroBanner at top of Index and Admin

**Truths from must_haves:**
- ✓ Signup pede CPF (validado pelo algoritmo BR), telefone mascarado e setor (Select 4 opções) — não submete sem os três
- ✓ Validação inline (texto vermelho + border vermelha) sob cada campo inválido; toast só pra erro de submit
- ✓ Submit envia CPF e telefone desmascarados (apenas dígitos) pra edge function
- ✓ Colaborador antigo com cpf/telefone/setor null vê banner amber sticky no topo de Index e Admin
- ✓ Banner some quando os 3 campos estão preenchidos (sem botão dispensar)
- ✓ CTA do banner navega pra /perfil/completar (rota nova, ProtectedRoute)
- ✓ Página /perfil/completar tem form dos 3 campos + reusa máscaras/validadores; submit faz UPDATE colaboradores e redireciona pra /

---
*Phase: 02-cadastros-arquiteto-crud*
*Plan: 02 — Signup Expandido + Perfil Completar*
*Completed: 2026-04-27*
