# 10-01 PUSH LOG — Migration RLS UPDATE orcamentos

**Plan:** 10-01
**Migration:** `supabase/migrations/20260514000002_orcamentos_status_rls.sql`
**Target:** prod (jkewlaezvrbuicmncqbj, sa-east-1)

---

## PRE-PUSH Snapshot

**Captured:** 2026-05-14T17:25:00Z
**Method:** `mcp__plugin_supabase__execute_sql`

### Policies atuais em `public.orcamentos`

| polname | polcmd | USING | WITH CHECK |
|---------|--------|-------|------------|
| Anyone can read orcamentos | r (SELECT) | `true` | NULL |
| Authenticated users can delete orcamentos | d (DELETE) | `true` | NULL |
| Authenticated users can insert orcamentos | a (INSERT) | NULL | `true` |
| Authenticated users can update orcamentos | w (UPDATE) | `true` | NULL |

**Total policies:** 4 (SELECT + INSERT + UPDATE + DELETE, todas permissivas).
**A substituir:** apenas a row UPDATE (`Authenticated users can update orcamentos`). As outras 3 ficam intactas — Phase 10 D-32 confirma SELECT fora de escopo; INSERT e DELETE não são mexidos.

### Count por status (integridade pre-push)

| status | count |
|--------|-------|
| rascunho | 4 |
| **TOTAL** | **4** |

**Observação:** Zero rows com `status='aprovado'` em prod hoje. Smoke "tentar UPDATE em row aprovada" no POST-PUSH será **n/a — sem row aprovada para testar**. Invariante one-way será validado em phase futura (10-04 cria rascunhos via UI e o smoke real cobre o fluxo).

### Pre-flight: dependencies

- `colaboradores.user_id`: **EXISTS** (data_type=uuid, is_nullable=YES). Subquery `(SELECT id FROM public.colaboradores WHERE user_id = auth.uid())` retorna NULL para colab sem linkage — UPDATE falha graciosamente nesse caso, comportamento correto.
- `public.has_role(uuid, app_role)`: **EXISTS** como SECURITY DEFINER (validado em Phase 9).

### Pre-flight assertions

- [x] Policy "Authenticated users can update orcamentos" PRESENTE no PRE-PUSH (Task 1 DROP IF EXISTS é seguro mas necessário)
- [x] `colaboradores.user_id` EXISTE
- [x] `public.has_role` EXISTE como SECURITY DEFINER

---

## Apply

(preenchido na Task 3)

---

## POST-PUSH Snapshot

(preenchido na Task 3)

---

## Smoke SQL

(preenchido na Task 3)

---

**Overall:** PENDING (aguardando Task 3)
