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

**Method:** `mcp__plugin_supabase__apply_migration`
**Name:** `orcamentos_status_rls`
**Project:** `jkewlaezvrbuicmncqbj`
**Started:** 2026-05-14T17:28:00Z
**Result:** SUCCESS (`{"success":true}`)
**Approved by:** Lenny via chat ("Aprovar — apply via MCP")

---

## POST-PUSH Snapshot

**Captured:** 2026-05-14T17:29:00Z

### Policies em `public.orcamentos` (POST)

| polname | polcmd | USING | WITH CHECK |
|---------|--------|-------|------------|
| Admin can update orcamentos non-aprovado | w (UPDATE) | `has_role(auth.uid(), 'admin'::app_role) AND (status <> 'aprovado'::text)` | `status = ANY (ARRAY['rascunho','aprovado','perdido','pendente'])` |
| Anyone can read orcamentos | r (SELECT) | `true` | NULL |
| Authenticated users can delete orcamentos | d (DELETE) | `true` | NULL |
| Authenticated users can insert orcamentos | a (INSERT) | NULL | `true` |
| Colab can update own orcamentos non-aprovado | w (UPDATE) | `colaborador_id = (SELECT colaboradores.id FROM colaboradores WHERE colaboradores.user_id = auth.uid()) AND (status <> 'aprovado'::text)` | `status = ANY (ARRAY['rascunho','aprovado','perdido','pendente'])` |

**Total policies:** 5 (subiu de 4 → 5: removida `"Authenticated users can update orcamentos"`, adicionadas 2 novas UPDATE).

### Count por status (integridade post-push)

| status | count |
|--------|-------|
| rascunho | 4 |
| **TOTAL** | **4** |

**Diff PRE → POST:** counts idênticos, zero linhas afetadas pelas mudanças de policy (correto — só mexemos em policy de RLS, não em dado).

---

## Smoke SQL

### (1) Policies novas presentes
✅ `Colab can update own orcamentos non-aprovado` aparece com USING contendo `colaborador_id = (SELECT ... FROM colaboradores ...)` + `status <> 'aprovado'`
✅ `Admin can update orcamentos non-aprovado` aparece com USING contendo `has_role(auth.uid(), 'admin'::app_role)` + `status <> 'aprovado'`
✅ Ambas têm WITH CHECK validando enum dos 4 status

### (2) Policy legada removida
✅ `Authenticated users can update orcamentos` NÃO aparece mais

### (3) Block one-way `aprovado`
**n/a — sem row aprovada em prod hoje** (count=0). Invariante será validado naturalmente quando 10-04 expuser dropdown e Lenny marcar um rascunho como `aprovado` no smoke da Phase 10.

### (4) Build local
✅ `npm run build`: exit 0 (built in 17.32s)

---

**Overall:** PASS
