# 10-05 Smoke — Phase 10 Production Validation

**Phase:** 10-wizard-edi-o-status-descri-o-rica
**Target:** https://orcamentosaura.com.br (prod)
**Cobertura:** 5 fluxos D-30 do CONTEXT.md
**Executor:** Lenny + Claude (Playwright MCP se possível, manual se não)

---

## Pré-flight (antes de começar)

- [ ] Plan 10-01 mergeado (RLS UPDATE em prod aplicada + verificada via 10-01-PUSH-LOG.md POST-PUSH)
- [ ] Plan 10-02 mergeado (TS sync + EncerrarNegociacaoModal deletado)
- [ ] Plan 10-03 mergeado (inputs inline Step3)
- [ ] Plan 10-04 mergeado (status dropdown + reabrir rascunho)
- [ ] Plan 10-05 mergeado (descrição rica)
- [ ] Build local exit 0 (`npm run build`)
- [ ] Deploy Vercel concluído (último commit aparece em https://vercel.com/...)
- [ ] Login em prod com conta Lenny + outra conta colab (se quiser exercitar permissões — opcional)

---

## Smoke 1 — Edição inline qty + preço no Step 3 (WIZ-01 + WIZ-02)

**Setup:** Criar um rascunho novo via wizard, do zero. Ir até o Step 3.

**Steps:**
1. Editar quantidade de uma luminária — digitar valor diferente e dar Tab/Enter
2. Confirmar que o subtotal da linha atualiza
3. Editar preço unitário da mesma luminária para um valor abaixo do preço mínimo
4. Confirmar que aparece o badge de violação (ícone laranja/triângulo) e o botão "Solicitar exceção"
5. Editar preço unitário acima do mínimo
6. Confirmar que badge de violação some
7. Gerar PDF
8. Abrir PDF gerado — confirmar valores editados aparecem (não os originais)

**Esperado:** Recalcs visíveis após blur/Enter. Violação detectada quando < precoMinimo. PDF reflete edits.

**Observed:** _(preencher)_

**Status:** PASS / FAIL

---

## Smoke 2 — Marcar rascunho como "perdido" (WIZ-04, transição livre)

**Setup:** Usar o rascunho criado em Smoke 1 (já existe na tab Pedidos).

**Steps:**
1. Ir em /admin?tab=pedidos
2. Localizar o orçamento criado em Smoke 1
3. Na coluna Status, abrir o dropdown
4. Selecionar "Perdido"
5. NÃO deve aparecer AlertDialog (transição livre)
6. Confirmar toast.success "Status atualizado para perdido"
7. Confirmar badge muda para vermelho

**Esperado:** Mudança instantânea, sem confirmação.

**Observed:** _(preencher)_

**Status:** PASS / FAIL

---

## Smoke 3 — Reabrir rascunho (WIZ-03, prefill + edit + save)

**Setup:** Criar um novo rascunho (cliente Y, ambientes, sistemas) e SAIR DO WIZARD sem gerar PDF. Status fica `rascunho`.

**Steps:**
1. Ir em /admin?tab=pedidos
2. Localizar o orçamento rascunho recém-criado
3. Hover sobre a linha → confirmar tooltip "Continuar este rascunho"
4. Clicar na linha (em qualquer lugar fora do dropdown)
5. Confirmar redirect para "/" (Index) e que o wizard abre no **Step 1** com o cliente/projeto/tipo pré-preenchidos
6. Avançar para Step 2 → confirmar ambientes/sistemas pré-preenchidos
7. Avançar para Step 3 → editar preço de algum item
8. Gerar PDF
9. Voltar para /admin?tab=pedidos → confirmar que **NÃO há orçamento duplicado** (mesmo id, agora com valor atualizado)

**Esperado:** Prefill completo no Step 1, edits persistem no mesmo registro, sem duplicata.

**Observed:** _(preencher)_

**Status:** PASS / FAIL

---

## Smoke 4 — Snapshot antigo (pré-v1.1) renderiza sem crash

**Setup:** Localizar um orçamento antigo em prod (criado antes de 2026-05-14) — o JSONB `ambientes` provavelmente NÃO tem os campos de descrição rica.

**Steps:**
1. Ir em /admin?tab=pedidos
2. Localizar orçamento antigo (data anterior a 2026-05-14 ou `pdf_template_version=1`)
3. Se status='rascunho' → clicar pra reabrir (Smoke 3 caminho)
4. Se status != 'rascunho' → clicar pra abrir a página de detalhe `/admin/orcamento/:id`
5. Console DevTools: verificar zero erros JS
6. Se reabriu o wizard: avançar até Step 3 → confirmar que a descrição **aparece como nome cru** (não há crash, não há "undefined K", não há `—`)
7. Se há produto no snapshot que não existe mais no master atual: confirmar que a linha ainda renderiza com snapshot puro

**Esperado:** Sem crash JS; descrição aparece em formato compatível (rica se o produto existe no master atual, crua se snapshot antigo sem dados ou produto sumiu).

**Observed:** _(preencher)_

**Status:** PASS / FAIL

---

## Smoke 5 — Marcar como "aprovado" (WIZ-04, one-way irreversível)

**Setup:** Criar (ou reusar) um rascunho novo simples.

**Steps:**
1. Ir em /admin?tab=pedidos
2. Localizar o orçamento
3. Na coluna Status, abrir o dropdown
4. Selecionar "Aprovado"
5. Confirmar que aparece **AlertDialog "Marcar como aprovado?"** com texto "Esta ação é irreversível..."
6. Clicar "Cancelar" — confirmar que status **NÃO muda**
7. Repetir: selecionar "Aprovado" no dropdown
8. Clicar "Confirmar"
9. Confirmar toast.success
10. Confirmar badge muda para verde
11. **Tentar reverter:** abrir o dropdown novamente — deve estar **disabled** (ou ao tentar trocar, retornar erro de RLS)
12. Confirmação server-side via Supabase MCP:
    ```sql
    SELECT id, status FROM public.orcamentos WHERE id = '<id-do-orcamento>';
    -- esperado: status = 'aprovado'
    ```
13. Tentar UPDATE direto via SQL (caso queira testar RLS):
    ```sql
    UPDATE public.orcamentos SET status = 'perdido' WHERE id = '<id-do-orcamento>' RETURNING id, status;
    -- esperado (como admin Lenny): 0 rows updated (RLS Plan 10-01 bloqueia)
    ```

**Esperado:** AlertDialog aparece para aprovado; cancelar não muda nada; confirmar grava; dropdown disabled após; RLS server-side bloqueia reverter mesmo via SQL direto.

**Observed:** _(preencher)_

**Status:** PASS / FAIL

---

## Summary

**Executed:** 2026-05-14T18:30Z (Lenny pilotando em prod, Claude monitorando chat)
**Method:** Manual via browser, 4 prints anexados aos turnos do chat

| Smoke | Cobertura | Status |
|-------|-----------|--------|
| 1 — Edit qty+preço Step 3 | WIZ-01 + WIZ-02 | **PASS** |
| 2 — Marcar perdido | WIZ-04 (transição livre) | **PASS** |
| 3 — Reabrir rascunho | WIZ-03 | **PASS** |
| 4 — Snapshot antigo | WIZ-05 (D-22 backward-compat) | **PASS** |
| 5 — Marcar aprovado | WIZ-04 (one-way D-16) | **PASS** |

**Overall:** 5/5 PASS

### Detalhes confirmados

- **Smoke 1:** Edit qty + preço inline funciona, badge de violação aparece quando preço < mínimo (LM1017 R$30 < R$37,66 mín), some quando corrigido, PDF reflete valores editados.
- **Smoke 2:** Dropdown "Perdido" muda direto sem dialog, toast "Status atualizado para perdido", badge vira vermelho.
- **Smoke 3:** Clicar linha de rascunho em /admin?tab=pedidos abre o wizard no Step 1 com prefill completo (cliente/projeto/tipo/ambientes/sistemas).
- **Smoke 4:** Orçamento antigo abre tela de detalhe sem crash JS. PDF re-emitido normalmente, sem "undefined K"/"undefined W". Console mostra apenas warnings de WebSocket Realtime (pré-existentes, não introduzidos pela Phase 10).
- **Smoke 5:** AlertDialog "Marcar como aprovado? Esta ação é irreversível" aparece; cancelar não muda status; confirmar vira badge verde; dropdown desabilitado depois (read-only).

### Bugs encontrados

Nenhum bug bloqueante.

### Polish items (follow-up — NÃO bloqueia closure)

1. **Smoke 1 — lag perceptível no input inline ao editar qty/preço.** Suspeita: o `useQuery` batch lookup (10-05 descrição rica) está re-renderizando o Step 3 a cada flush. Mitigação possível: estabilizar o `queryKey` ou debounce no flush. Anotar como ticket técnico (não regressão funcional — edit funciona, só com fricção).

### Console errors (não-bloqueantes)

- `WebSocket connection to wss://...supabase.co/realtime/v1/websocket failed: WebSocket is closed before the connection is established.` — pré-existente, vem da subscription do ExceptionChat. Aparece em todas as páginas do app, não foi introduzido pela Phase 10.
