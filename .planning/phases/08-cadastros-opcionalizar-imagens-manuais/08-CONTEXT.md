# Phase 8: Cadastros — Opcionalizar + Imagens Manuais - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Cadastros deixam de bloquear o usuário em campos não-essenciais, arquiteto vira ficha completa do escritório, produtos coringa AU001..AU016 ficam visivelmente editáveis e admin ganha entrypoint inline pra anexar/trocar imagem em qualquer SKU. **Sem mexer em wizard, sem RLS policies, sem PDF.** Migration aditiva em `arquitetos` (7 colunas nullable) é a única mudança de schema da phase.

**Por requirement:**
- **FORM-01:** Cliente sem Contato, CPF/CNPJ e Arquiteto obrigatórios — só Nome continua required
- **FORM-02:** Arquiteto ganha data_nascimento, endereço (string única), dados bancários (5 colunas typed)
- **FORM-03:** 16 coringas AU001..AU016 viram visivelmente editáveis (achado: edit já funciona tecnicamente; gap é descrição genérica e zero imagens em prod)
- **FORM-04:** Botão inline de anexar/trocar imagem em qualquer linha da tab Cadastros > Produtos

**Out of scope:**
- RLS policies em `arquitetos`/`clientes` — Phase 9 cuida (`user_id` já foi adicionado na Phase 7)
- Edição em massa de imagens — ImportImagens permanece
- Sync de `auth.users` com cadastro do colaborador
- Wizard edição (Phase 10) e PDF (Phase 11)

</domain>

<decisions>
## Implementation Decisions

### Schema do arquiteto expandido (FORM-02)
- **D-01:** `arquitetos.endereco TEXT NULL` — string única free-form, sem ViaCEP, sem estrutura. Alinha com pattern de `contato` já existente. Justificativa: v1.1 não tem caso de uso de filtro por UF/cidade; estruturar depois se aparecer.
- **D-02:** Dados bancários em 5 colunas typed (todas TEXT NULL): `banco`, `agencia`, `conta`, `tipo_conta`, `pix`. Sem JSONB (perde typing TS). Pix coexiste com banco/agência/conta como campos paralelos opcionais.
- **D-03:** `arquitetos.data_nascimento DATE NULL` + index BTREE (`idx_arquitetos_data_nascimento`) — replica padrão Phase 7 D-07/D-08 pra eventual cron de aniversário do arquiteto no futuro (mesmo que Phase 12 hoje só dispare pra clientes, schema fica consistente).
- **D-04:** Permissão de edit = admin + colab dono. Phase 9 ainda não ativou RLS, mas a UI pode antecipar a regra: form completo abre só pra `useUserRole === 'admin' OR arquiteto.user_id === user.id`. Garante zero retrabalho quando Phase 9 chegar.

### Schema migration (FORM-02)
- **D-05:** Nova migration `supabase/migrations/20260512000001_arquitetos_expand_fields.sql` adicionando 7 colunas aditivas em uma única migration:
  - `data_nascimento DATE NULL`
  - `endereco TEXT NULL`
  - `banco TEXT NULL`, `agencia TEXT NULL`, `conta TEXT NULL`, `tipo_conta TEXT NULL`, `pix TEXT NULL`
  - + index BTREE `idx_arquitetos_data_nascimento`
  - + COMMENT em cada coluna citando "Phase 8 FORM-02"
- **D-06:** Migration aplicada em prod via `supabase db push` no fechamento da phase (mesmo padrão Phase 7 Plan 07-04). PUSH-LOG documenta counts pré/pós.

### Coringa AU001..AU016 (FORM-03)
- **D-07:** **Achado importante:** os 16 coringas existem em prod com descrição genérica (`"Drivers"`, `"Plug para Fita LED"`, etc.) e ZERO com `imagem_url`. `ProdutoEditDialog` já permite editar descrição + imagem normalmente (nenhum bloqueio técnico — botão Pencil aparece em todas as linhas). FORM-03 não precisa remover bloqueio; precisa **garantir visibilidade**: confirmar que aparecem na lista da tab Cadastros > Produtos (provavelmente já aparecem, plan deve testar) e talvez adicionar hint visual (badge "coringa" ou ordenar por descricao IS NULL primeiro).
- **D-08:** Imagem coringa vai pro mesmo bucket `produto-imagens` (singular conforme intel pendente — vide memory `project_aura_pending_cleanup`), path `<codigo>.<ext>` igual `uploadProdutoImagem.ts` faz pros outros. Sem bucket separado.
- **D-09:** NÃO setar `editado_manualmente=true` ao salvar edit de coringa. D-10 do `reconcileProducts.ts` (`origem='coringa' → NUNCA sobrescrito por master`) já garante imunidade — flag adicional seria redundante. `origem` permanece `'coringa'`.
- **D-10:** Código do coringa (AU001..AU016) permanece **imutável**. `ProdutoEditDialog.tsx:233` já desabilita o input `codigo` em `mode='edit'` — manter assim. Os 16 códigos são canonicais (referenciados em orçamentos existentes via produto_id, mas alguns lookups podem cair em codigo — preservar evita regressão).

### FORM-04 — anexar imagem inline por linha
- **D-11:** Botão de imagem **inline no row** da tabela `produtos` na tab Cadastros > Produtos. Ícone `ImageIcon` (lucide-react já importado em `src/pages/Admin.tsx:460`), ao lado do botão Pencil de edit. Click abre `ProdutoEditDialog` em **modo edit normal** (o dialog já tem upload de imagem na linha 307-340) — sem criar modo "focused-image" novo. Justificativa: simplicidade + reutilização total.
- **D-12:** Substituição direta da imagem anterior, sem preview de confirmação (já é assim no ImportImagens). Path do bucket sobrescreve se existir (`upsert: true`). Toast `"Imagem atualizada"` confirma.
- **D-13:** Funciona pra **qualquer** SKU (master importado, manual, coringa, legado) — uniform. Sem distinção por origem.

### FORM-01 — cliente opcional (sinalização)
- **D-14:** Remover `required` do JSX em `ClienteDialog.tsx` nos 3 campos: Contato (linha ~115), CPF/CNPJ (linha ~124), Arquiteto (linha ~133). `nome` continua required (linha 109).
- **D-15:** Adicionar `(opcional)` inline nos labels dos 3 campos: `<Label>Contato <span className="text-muted-foreground">(opcional)</span></Label>`. Não usar asterisco vermelho (não é padrão atual do projeto).
- **D-16:** Validação de **formato** do CPF/CNPJ permanece quando preenchido (o `formatCpfCnpj`/`unmask` em `ClienteDialog.tsx` já mascara; format check fica). Validação que rejeita CPF inválido por DV: manter como está (não scope desta phase).
- **D-17:** Backend: payload já manda `contato.trim() || null`, `cpf_cnpj: cpfCnpj.trim() ? unmask(cpfCnpj) : null`, `arquiteto_id: arquitetoId` (já nullable). Schema já permite. Zero mudança SQL pra FORM-01.

### Smoke de fechamento (replica Phase 7 padrão)
- **D-18:** Smoke pós-push em prod: criar cliente apenas com nome (FORM-01); editar arquiteto e preencher 1 campo bancário (FORM-02 + persistência); editar coringa AU001 colocando descrição + imagem; usar botão imagem inline em 1 produto master (FORM-04). 4 checks manuais via Playwright + 1 SQL pra confirmar persistência das colunas novas em `arquitetos`.

### Claude's Discretion
- Ordem dos campos no form arquiteto expandido (data nascimento + endereço primeiro? Banco no fim?)
- Wording exato do hint "(opcional)" — pode ser `<small>` cinza ou apenas texto inline
- Posicionamento exato do ícone de imagem inline (antes ou depois do Pencil)
- Texto exato dos COMMENT SQL
- Se mostrar badge "coringa" na lista ou só permitir filtro

### Folded Todos
[Nenhum todo dobrado — `gsd-tools todo match-phase` não retornou matches relevantes pra Phase 8.]

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §FORM — FORM-01..04 definidos
- `.planning/ROADMAP.md` §"Phase 8" — goal + success criteria
- `.planning/PROJECT.md` — constraint "schema sempre aditivo"

### Phase 7 carry-over (schema já em prod)
- `.planning/phases/07-schema-prep-v1-1/07-CONTEXT.md` §D-07..D-09 — padrão `data_nascimento DATE NULL` + index BTREE replicado em D-03 desta phase
- `.planning/phases/07-schema-prep-v1-1/07-CONTEXT.md` §D-15..D-18 — gap policy de produtos coringa (D-18: coringas fora da auditoria master)
- `supabase/migrations/20260511000002_clientes_data_nascimento.sql` — template estrutural pra D-05 (BEGIN/COMMIT + ADD COLUMN + INDEX + COMMENT)

### Código existente (não reescrever — estender)
- `src/components/ClienteDialog.tsx` — FORM-01 modifica linhas ~109, ~115, ~124, ~133 (tirar required + adicionar "(opcional)")
- `src/components/ArquitetoDialog.tsx` — FORM-02 expande de 101 linhas pra incluir 7 campos novos
- `src/components/ProdutoEditDialog.tsx` — FORM-03 reusa sem modificar; FORM-04 abre o dialog existente via novo ícone
- `src/lib/uploadProdutoImagem.ts` — path/bucket pattern pra FORM-04 (já implementado)
- `src/lib/reconcileProducts.ts` §D-10 — garante coringa não é sobrescrito; FORM-03 NÃO mexe nessa lógica
- `src/pages/Admin.tsx:566-595` — row da tabela produtos onde FORM-04 adiciona o botão inline

### Domínio / regras de negócio
- `src/types/orcamento.ts` — interfaces de Cliente/Arquiteto (talvez precise estender pra FORM-02)
- `src/integrations/supabase/types.ts` — regenerar após push da migration FORM-02 (gsd-tools handles)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ProdutoEditDialog** (361 linhas): suporta create/edit com upload de imagem completo. FORM-03 e FORM-04 reusam 100%.
- **uploadProdutoImagem.ts**: helper pra subir pro bucket `produto-imagens`, path `<codigo>.<ext>`. Funciona pra qualquer origem (master/coringa/manual).
- **ArquitetoDialog** (101 linhas): base existe, precisa só adicionar campos no useState + JSX + payload + edit hydration.
- **shadcn-ui** Card/Dialog/Input/Label: form expandido segue padrão do ClienteDialog.
- **reconcileProducts.ts**: D-10 protege coringa de sobrescrita master. Não tocar.

### Established Patterns
- Schema aditivo (PROJECT.md): toda coluna nova é NULL + sem default destrutivo. Replicado nas 7 colunas FORM-02.
- Form submission: destructure `{ data, error }` → toast.error se erro → onSuccess + close. Aplica em Cliente/Arquiteto dialogs.
- Bucket único `produto-imagens` (singular, pending cleanup) — não criar bucket novo pra coringa.

### Integration Points
- Tab Cadastros > Produtos (`src/pages/Admin.tsx:503-598`): adicionar coluna/ícone de imagem inline
- ArquitetoDialog na lista de cadastros (`src/pages/Admin.tsx:1114-1120`): mode='edit' já passa o arquiteto — apenas form precisa hydrate dos novos campos
- ClienteDialog (`src/pages/Admin.tsx:1122-1135`) + ClienteList.tsx (se houver): FORM-01 toca só no dialog
- types.ts regen após migration: workflow Phase 7 já documentou (D-13 da Phase 7); replicar no fim de Phase 8

</code_context>

<specifics>
## Specific Ideas

- Lenny rodou UAT em prod (2026-05-11) e listou os 4 FORM items pessoalmente. Não há prazos rígidos.
- Os 16 coringas em prod têm descrição genérica do tipo `"Drivers"`, `"Lâmpadas LED"` — admin provavelmente quer reescrever pra algo descritivo do produto real (ex: "Fita LED 24V 12W/m IRC>90 3000K"). Phase 8 abre o caminho, mas o conteúdo é trabalho contínuo (não escopo da phase).
- Pix vai como TEXT genérico (aceita CPF, email, telefone, chave aleatória — tudo string).

</specifics>

<deferred>
## Deferred Ideas

- **Endereço estruturado (CEP + ViaCEP)** — discutido, deferido em D-01. Reabrir se filtro por UF/cidade virar prioridade.
- **Bucket separado para coringa** — discutido, deferido em D-08. Não há justificativa atual.
- **Marcar `editado_manualmente=true` em coringa por defesa** — discutido, deferido em D-09 (D-10 do reconcile já protege).
- **Modo "focused-image" no ProdutoEditDialog** — discutido, deferido em D-11 (reuso do dialog completo é mais simples).
- **Editar código (AU001..AU016) do coringa** — discutido, rejeitado em D-10 (quebra orçamentos).

### Reviewed Todos (not folded)
[Nenhum todo revisado/deferido — `match-phase` não trouxe candidatos.]

</deferred>

---

*Phase: 08-cadastros-opcionalizar-imagens-manuais*
*Context gathered: 2026-05-11*
