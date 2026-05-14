# Phase 9: Multi-tenancy RLS - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 09-multi-tenancy-rls
**Areas discussed:** DEFAULT auth.uid() vs dialog injetar, Smoke bilateral (2 contas reais), Permissão de admin no INSERT
**Skipped:** Edge cases nas queries do client (capturado como tarefa de auditoria do plan via D-09/D-10)

---

## Area: DEFAULT auth.uid() vs dialog injetar

### Q1: Como tratar a injeção de user_id no INSERT?

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Adicionar DEFAULT auth.uid() na coluna | Migração aditiva ALTER COLUMN SET DEFAULT. Defesa contra próximo caller esquecido | ✓ |
| Manter como está (hotfix do dialog) | Só dialog injeta user_id. Risco: próximo caller que esquecer quebra com 400 | |
| Tirar o hotfix e forçar via DEFAULT | DEFAULT + reverter commit 71d28d7. Código mais limpo, mais mexida | |

**User's choice:** Adicionar DEFAULT auth.uid() na coluna
**Notes:** Cinto-e-suspensórios — hotfix do dialog vira redundância segura, schema desacoplado da UI

### Q2: Onde colocar a migração do DEFAULT auth.uid()?

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Junto com a migração das policies | 1 migration só: DEFAULT + DROP/CREATE policies. Atômico no BEGIN/COMMIT | ✓ |
| Migration separada | 2 migrations (DEFAULT primeiro, policies depois). Mais isolamento mas 2 push | |

**User's choice:** Junto com a migração das policies
**Notes:** Replica padrão Drive (1 migration coesa por domínio)

---

## Area: Smoke bilateral (2 contas reais)

### Q1: Como validar isolamento colab-A não vê colab-B?

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Criar 2 colabs de teste em prod, validar, deletar | smoke-colab-a/b via signup real, cleanup ao fim. ~15min | ✓ |
| Usar Lenny + 1 colab teste só | Cobertura menor mas testa caminho crítico | |
| Deferir pra Phase 13 (closure) | Phase 9 fecha só com smoke SQL. Risco: bug aparece no closure | |
| SQL puro com SET ROLE | Sem UI, rápido, repetivél, mas não pega bug de client query | |

**User's choice:** Criar 2 colabs de teste em prod, validar, deletar
**Notes:** Smoke real cobre tanto policy quanto callsites do client em uma passada

---

## Area: Permissão de admin no INSERT

### Q1: Admin deve poder criar arquiteto/cliente em nome de outro colab?

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Não — replicar Drive (WITH CHECK = user_id = auth.uid()) | Mesmo padrão Drive. Admin transfere via UPDATE. Sem caso de uso atual | ✓ |
| Sim — admin pode criar com user_id arbitrário | Útil pra onboarding em massa mas exige UI nova com selector | |
| Sim mas só via UPDATE | Equivalente à opção 1 funcionalmente | |

**User's choice:** Não — replicar Drive
**Notes:** Consistência com padrão Drive validado em prod desde Phase 4

---

## Claude's Discretion

- Naming exato das policies (pode replicar literalmente Drive)
- Estrutura do PUSH-LOG
- Ordem das policies dentro da migration

## Deferred Ideas

- Edge cases nas queries do client — capturado como tarefa de auditoria do plan, não como pre-locked decision
- Admin INSERT cross-user — revisitar se onboarding em massa virar caso de uso
- Cleanup automático dos 2 auth.users de smoke — pending cleanup (precisa service role)
